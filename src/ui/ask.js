// Reemplazo de window.prompt(): en la app de escritorio (webview de Tauri) prompt() no existe y devuelve null,
// así que botones como «Nuevo proyecto» parecían no hacer nada. Esto es un diálogo propio, asíncrono y accesible.
//   const nombre = await sahtenAsk('Nombre del negocio:', 'Mi negocio');   // string, o null si se cancela
export function sahtenAsk(message, defaultValue = '', { multiline = false, confirmLabel = 'Aceptar' } = {}) {
  return new Promise(resolve => {
    const d = document;
    const ov = d.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:30000;background:rgba(10,20,12,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    const box = d.createElement('div');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.style.cssText = 'background:var(--card,#fff);color:var(--ink,#1e2c1f);border-radius:16px;width:100%;max-width:440px;padding:20px 22px;box-shadow:0 24px 80px rgba(0,0,0,.35);font-family:inherit';
    const label = d.createElement('div'); label.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:12px;white-space:pre-line;line-height:1.45'; label.textContent = message;
    const input = d.createElement(multiline ? 'textarea' : 'input');
    input.value = defaultValue == null ? '' : String(defaultValue);
    input.style.cssText = 'width:100%;box-sizing:border-box;border:1.5px solid var(--border,#e2ddd5);border-radius:10px;padding:10px 12px;font:inherit;background:var(--sand,#f7f4ef);color:inherit;outline:none';
    const row = d.createElement('div'); row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:16px';
    const mk = (txt, primary) => { const b = d.createElement('button'); b.type = 'button'; b.textContent = txt; b.style.cssText = 'border-radius:10px;padding:9px 18px;font:inherit;font-weight:700;cursor:pointer;border:1.5px solid ' + (primary ? 'var(--accent,#F28C00)' : 'var(--border,#e2ddd5)') + ';background:' + (primary ? 'var(--accent,#F28C00)' : 'transparent') + ';color:' + (primary ? '#fff' : 'inherit'); return b; };
    const no = mk('Cancelar', false), ok = mk(confirmLabel, true);
    const done = v => { ov.remove(); resolve(v); };
    no.onclick = () => done(null); ok.onclick = () => done(input.value);
    ov.addEventListener('mousedown', e => { if (e.target === ov) done(null); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !multiline) { e.preventDefault(); done(input.value); } else if (e.key === 'Escape') done(null); });
    row.append(no, ok); box.append(label, input, row); ov.appendChild(box); d.body.appendChild(ov);
    setTimeout(() => { input.focus(); input.select && input.select(); }, 0);
  });
}
