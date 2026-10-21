-- Aplicar después de schema.sql. Secretos solo en Vault; ningún cliente llama al backend RPC.
create schema if not exists sahten_private;
revoke all on schema sahten_private from public, anon;
grant usage on schema sahten_private to service_role;

create table if not exists sahten_private.mp_accounts (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  account_id text not null, account_label text not null, mode text not null check(mode in ('test','production')),
  site_url text not null, enabled boolean not null default false, secret_id uuid not null,
  created_at timestamptz not null default now()
);
create unique index if not exists mp_one_active_account on sahten_private.mp_accounts(store_id) where enabled;
create table if not exists sahten_private.mp_checkouts (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  account_id uuid not null references sahten_private.mp_accounts(id), request_id uuid not null,
  proof_hash text not null, quote_hash text not null, order_payload jsonb not null,
  preference_id text, checkout_url text, payment_status text not null default 'pending',
  lease_until timestamptz, attempts int not null default 0, expires_at timestamptz not null default now()+interval '30 minutes',
  order_id uuid references public.orders(id), created_at timestamptz not null default now(),
  unique(store_id,request_id)
);
create table if not exists sahten_private.mp_payments (
  id text primary key, checkout_id uuid not null references sahten_private.mp_checkouts(id),
  status text not null, amount_cents bigint not null, refunded_cents bigint not null, updated_at timestamptz not null
);
create table if not exists sahten_private.mp_limits (
  bucket text primary key, count int not null default 0, until_at timestamptz not null
);
alter table sahten_private.mp_accounts enable row level security;
alter table sahten_private.mp_checkouts enable row level security;
alter table sahten_private.mp_payments enable row level security;
alter table sahten_private.mp_limits enable row level security;
revoke all on all tables in schema sahten_private from public,anon,authenticated;

alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_status text;
alter table public.orders add column if not exists payment_ref uuid;
alter table public.orders add column if not exists payment_updated_at timestamptz;
create unique index if not exists orders_payment_ref_unique on public.orders(payment_ref) where payment_ref is not null;
-- Los permisos originales de INSERT/UPDATE ya son por columna: no conceder escritura de las nuevas columnas.

create or replace function sahten_private.mp_backend(action text, args jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid; acc sahten_private.mp_accounts; c sahten_private.mp_checkouts; secret uuid;
  state text; paid bigint; refunded bigint; charged boolean; pending boolean; disputed boolean; amount bigint;
  payload jsonb; oid uuid; p record; proof text;
begin
  if action='limit' then
    -- Ventana fija y transacción atómica; se guarda solo un hash del origen, nunca la IP.
    insert into sahten_private.mp_limits(bucket,count,until_at) values(args->>'bucket',1,now()+interval '10 minutes')
    on conflict(bucket) do update set count=case when mp_limits.until_at<now() then 1 else mp_limits.count+1 end,
      until_at=case when mp_limits.until_at<now() then now()+interval '10 minutes' else mp_limits.until_at end
    returning count into amount;
    return to_jsonb(amount <= least(120,greatest(1,(args->>'max')::int)));
  end if;
  if action='account' then
    select * into acc from sahten_private.mp_accounts where store_id=(args->>'store_id')::uuid and enabled;
    if not found then return null; end if;
    return to_jsonb(acc)-'secret_id';
  elsif action='secrets' then
    select * into acc from sahten_private.mp_accounts where id=(args->>'account_id')::uuid;
    if not found then return null; end if;
    select decrypted_secret::jsonb into payload from vault.decrypted_secrets where id=acc.secret_id;
    return (to_jsonb(acc)-'secret_id') || jsonb_build_object('credentials',payload);
  elsif action='webhook_accounts' then
    return coalesce((select jsonb_agg((to_jsonb(a)-'secret_id')||jsonb_build_object('credentials',v.decrypted_secret::jsonb) order by a.enabled desc,a.created_at desc)
      from sahten_private.mp_accounts a join vault.decrypted_secrets v on v.id=a.secret_id
      where a.store_id=(args->>'store_id')::uuid),'[]'::jsonb);
  elsif action='save_account' then
    sid:=(args->>'store_id')::uuid;
    perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
    -- Versiones anteriores siguen disponibles solo para verificar pagos ya iniciados.
    update sahten_private.mp_accounts set enabled=false where store_id=sid and enabled;
    select vault.create_secret((args->'credentials')::text) into secret;
    insert into sahten_private.mp_accounts(store_id,account_id,account_label,mode,site_url,enabled,secret_id)
    values(sid,args->>'account_id',args->>'account_label',args->>'mode',args->>'site_url',true,secret)
    returning * into acc;
    -- Habilitar solo este medio de pago; conservar catálogo, precios, fotos y contenido publicados.
    update public.menus set json=jsonb_set(json,'{payments}',coalesce(json->'payments','{}'::jsonb)||
      jsonb_build_object('methods',coalesce(json#>'{payments,methods}','{}'::jsonb)||jsonb_build_object('mercadopago',true)))
      where store_id=sid;
    return to_jsonb(acc)-'secret_id';
  elsif action='disable_account' then
    update sahten_private.mp_accounts set enabled=false where store_id=(args->>'store_id')::uuid;
    update public.menus set json=jsonb_set(json,'{payments}',coalesce(json->'payments','{}'::jsonb)||
      jsonb_build_object('methods',coalesce(json#>'{payments,methods}','{}'::jsonb)||jsonb_build_object('mercadopago',false)))
      where store_id=(args->>'store_id')::uuid;
    return '{}'::jsonb;
  elsif action='checkout' then
    select * into c from sahten_private.mp_checkouts where id=(args->>'id')::uuid;
    if not found then return null; end if;
    return to_jsonb(c)||jsonb_build_object('order',c.order_payload,'mode',(select mode from sahten_private.mp_accounts where id=c.account_id));
  elsif action='reserve' then
    sid:=(args->>'store_id')::uuid;
    insert into sahten_private.mp_checkouts(store_id,account_id,request_id,proof_hash,quote_hash,order_payload)
    values(sid,(args->>'account_id')::uuid,(args->>'request_id')::uuid,args->>'proof_hash',args->>'quote_hash',args->'order')
    on conflict(store_id,request_id) do nothing;
    select * into c from sahten_private.mp_checkouts where store_id=sid and request_id=(args->>'request_id')::uuid for update;
    if c.proof_hash<>args->>'proof_hash' or c.quote_hash<>args->>'quote_hash' then raise exception 'checkout_conflict'; end if;
    if c.expires_at<now() and c.payment_status<>'paid' then raise exception 'checkout_expired'; end if;
    if c.checkout_url is null and c.payment_status<>'paid' then
      if c.lease_until>now() then raise exception 'checkout_busy'; end if;
      update sahten_private.mp_checkouts set lease_until=now()+interval '30 seconds',attempts=attempts+1 where id=c.id returning * into c;
    end if;
    return to_jsonb(c)||jsonb_build_object('order',c.order_payload,'mode',(select mode from sahten_private.mp_accounts where id=c.account_id));
  elsif action='preference' then
    update sahten_private.mp_checkouts set preference_id=args->>'preference_id',checkout_url=args->>'checkout_url',lease_until=null
    where id=(args->>'id')::uuid;
    return '{}'::jsonb;
  elsif action='release' then
    update sahten_private.mp_checkouts set lease_until=null where id=(args->>'id')::uuid;
    return '{}'::jsonb;
  elsif action='payment' then
    select * into c from sahten_private.mp_checkouts where id=(args->>'checkout_id')::uuid for update;
    if not found then raise exception 'checkout_not_found'; end if;
    if exists(select 1 from sahten_private.mp_payments where id=args->>'id' and checkout_id<>c.id) then raise exception 'payment_mismatch'; end if;
    insert into sahten_private.mp_payments(id,checkout_id,status,amount_cents,refunded_cents,updated_at)
    values(args->>'id',c.id,args->>'status',(args->>'amount_cents')::bigint,(args->>'refunded_cents')::bigint,(args->>'updated_at')::timestamptz)
    on conflict(id) do update set status=excluded.status,amount_cents=excluded.amount_cents,refunded_cents=excluded.refunded_cents,updated_at=excluded.updated_at
    where mp_payments.updated_at<=excluded.updated_at;
    select coalesce(sum(case when status='approved' then amount_cents-refunded_cents else 0 end),0),
      coalesce(sum(refunded_cents),0),coalesce(bool_or(status='charged_back'),false),
      coalesce(bool_or(status in ('pending','in_process')),false),coalesce(bool_or(status='in_mediation'),false)
    into paid,refunded,charged,pending,disputed from sahten_private.mp_payments where checkout_id=c.id;
    amount:=round((c.order_payload->>'total')::numeric*100)::bigint;
    state:=case when charged then 'charged_back' when disputed then 'in_mediation' when paid>amount then 'overpaid' when paid=amount then 'paid'
      when refunded>0 and paid=0 then 'refunded' when refunded>0 then 'partially_refunded'
      when paid>0 then 'partial' when pending then 'pending' else 'rejected' end;
    oid:=c.order_id;
    select * into acc from sahten_private.mp_accounts where id=c.account_id;
    if state in ('paid','overpaid') and oid is null and acc.mode='production' then
      -- La primera acreditación completa crea exactamente un pedido; webhooks repetidos no duplican la venta.
      insert into public.orders(store_id,payload,payment_provider,payment_status,payment_ref,payment_updated_at)
      values(c.store_id,c.order_payload||jsonb_build_object('createdAt',now(),'num',floor(random()*9000)+1000),
        'mercadopago',state,c.id,now()) returning id into oid;
    elsif oid is not null then
      update public.orders set payment_status=state,payment_updated_at=now() where id=oid;
    end if;
    update sahten_private.mp_checkouts set payment_status=state,order_id=oid where id=c.id;
    return jsonb_build_object('payment_status',state,'order_id',oid);
  end if;
  raise exception 'unknown_action';
end $$;
revoke all on function sahten_private.mp_backend(text,jsonb) from public,anon,authenticated;
grant execute on function sahten_private.mp_backend(text,jsonb) to service_role;
-- El wrapper no eleva privilegios y solo el rol del servidor puede ejecutarlo.
create or replace function public.sahten_mp_backend(action text,args jsonb) returns jsonb
language sql security invoker set search_path = '' as $$select sahten_private.mp_backend(action,args)$$;
revoke all on function public.sahten_mp_backend(text,jsonb) from public,anon,authenticated;
grant execute on function public.sahten_mp_backend(text,jsonb) to service_role;
