import { createPaymentClient } from './client.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

export function createPaymentUi({ online, w = window }) {
  const client = createPaymentClient({ online }), d = w.document;
  let generation = 0;
  const context = () => online.conn().storeId + ':' + online.conn().projectId;
  const host = () => d.getElementById('mp-account-slot');
  const api = {
    clear() { generation++; if (host()) host().replaceChildren(); },
    async render() {
      const el = host(); if (!el) return;
      const gen = ++generation, ctx = context(), info = online.controller.info();
      el.innerHTML = '<div class="card" style="padding:20px;margin-bottom:16px"><h3 style="margin:0 0 8px">Mercado Pago</h3><div role="status" id="mp-account-status">Consultando conexión…</div></div>';
      if (!online.enabled || !info.signedIn || !online.conn().storeId) { el.querySelector('[role=status]').textContent = 'Para cobrar desde la web, conectá este negocio e iniciá sesión en Nube y usuarios.'; return; }
      let account;
      try { account = await client.load(); } catch (e) {
        if (gen !== generation || ctx !== context() || !el.isConnected) return;
        el.querySelector('[role=status]').textContent = e.status === 404 ? 'La conexión de pagos todavía no está instalada en este servidor.' : e.message;
        return;
      }
      if (gen !== generation || ctx !== context() || !el.isConnected) return;
      el.innerHTML = `<div class="card mp-card" style="padding:20px;margin-bottom:16px">
        <h3 style="margin:0 0 8px">Mercado Pago</h3>
        <p style="font-size:13px;margin:0 0 12px">${account.connected ? 'Cuenta conectada: <b>'+esc(account.accountLabel)+'</b> · '+(account.mode==='production'?'Cobros reales':'Modo de prueba') : 'Conectá la cuenta de este negocio para cobrar los pedidos de su web.'}</p>
        <p style="font-size:13px;color:var(--ink)">El cliente paga en Mercado Pago. Los cobros llegan a la cuenta de este negocio y la app recibe su confirmación.</p>
        <details ${account.connected?'':'open'}><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600">${account.connected?'Cambiar credenciales':'Agregar API de Mercado Pago'}</summary>
          <form id="mp-account-form" style="display:grid;gap:12px;max-width:560px;margin-top:12px">
            <div><label for="mp-mode">Ambiente</label><select class="form-input" id="mp-mode"><option value="test">Pruebas · sin cobros reales</option><option value="production">Producción · cobros reales</option></select></div>
            <div><label for="mp-site">Dirección web de este negocio</label><input class="form-input" id="mp-site" type="url" required placeholder="https://tu-tienda.com" value="${esc(account.siteUrl||'')}"></div>
            <div><label for="mp-access-token">Access Token</label><input class="form-input" id="mp-access-token" type="password" required autocomplete="new-password" spellcheck="false"></div>
            <div><label for="mp-webhook-url">URL de notificaciones · evento Pagos</label><input class="form-input" id="mp-webhook-url" readonly value="${esc(account.webhookUrl)}"><button class="btn" type="button" id="mp-copy-webhook" style="margin-top:6px">Copiar URL</button></div>
            <div><label for="mp-webhook-secret">Clave secreta de Webhooks</label><input class="form-input" id="mp-webhook-secret" type="password" required autocomplete="new-password" spellcheck="false"></div>
            <p style="font-size:12px;color:var(--ink);margin:0">Las claves se envían al servidor y se guardan cifradas. No se incluyen en el archivo del negocio ni se muestran en la web. Al cambiarlas, volvé a cargar ambos campos.</p>
            <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noopener">Abrir mis integraciones de Mercado Pago ↗</a>
            <button class="btn btn-accent" type="submit">Verificar y guardar conexión</button>
          </form>
        </details>
        ${account.connected?'<button class="btn" id="mp-disable" style="margin-top:12px">Deshabilitar nuevos cobros</button>':''}
        <p id="mp-account-message" role="status" style="font-size:13px;margin:12px 0 0"></p>
      </div>`;
      const form = d.getElementById('mp-account-form'), message = d.getElementById('mp-account-message');
      d.getElementById('mp-mode').value = account.mode || 'test';
      d.getElementById('mp-copy-webhook').addEventListener('click', async () => {
        try { await w.navigator.clipboard.writeText(account.webhookUrl); message.textContent = 'URL copiada. Pegala en Webhooks de tu aplicación de Mercado Pago y seleccioná Pagos.'; }
        catch { d.getElementById('mp-webhook-url').select(); message.textContent = 'La URL está seleccionada para copiar.'; }
      });
      form.addEventListener('submit', async e => {
        e.preventDefault(); if (ctx !== context()) return;
        const fields = { mode: d.getElementById('mp-mode').value, siteUrl: d.getElementById('mp-site').value.trim(), accessToken: d.getElementById('mp-access-token').value.trim(), webhookSecret: d.getElementById('mp-webhook-secret').value.trim() };
        d.getElementById('mp-access-token').value = ''; d.getElementById('mp-webhook-secret').value = '';
        const controls = [...form.querySelectorAll('input,select,button')]; controls.forEach(c=>c.disabled=true); message.textContent='Verificando la cuenta…';
        try {
          await client.save(fields);
          if (ctx !== context()) return;
          const cfg=w._getTiendaConfig(); cfg.paymentMethods.mercadopago=true; w._saveTiendaConfig(cfg);
          await api.render(); if (d.getElementById('mp-account-message')) d.getElementById('mp-account-message').textContent = 'Conexión guardada. Probá la compra desde tu web agregando ?mp_test=1 a su dirección si elegiste Pruebas.';
        } catch (error) { if (ctx === context() && message.isConnected) { message.textContent=error.message; controls.forEach(c=>c.disabled=false); } }
        finally { fields.accessToken=''; fields.webhookSecret=''; }
      });
      d.getElementById('mp-disable')?.addEventListener('click', async () => {
        if (!await w.sahtenConfirm('¿Deshabilitar nuevos cobros con Mercado Pago para este negocio? Los pedidos y pagos anteriores se conservan.', {okLabel:'Deshabilitar'})) return;
        try { await client.disable(); if(ctx===context()) await api.render(); } catch(e) {message.textContent=e.message;}
      });
    },
  };
  return api;
}
