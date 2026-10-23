-- Ejecutar manualmente en Supabase SQL Editor antes de publicar el tablero.
-- Se conserva la estructura existente y se amplían los estados admitidos.
-- Requiere revisar previamente que el constraint se llame orders_status_check.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pendiente', 'recibido', 'preparando', 'listo', 'enviado', 'retirado', 'entregado', 'cancelado'));
