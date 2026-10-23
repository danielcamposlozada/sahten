import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createOnlineUi } from '../src/online/ui.js';

function setup(role = 'owner') {
  const dom = new JSDOM('<div id="nube-users"></div><div id="nube-audit"></div>');
  const online = {
    role: () => role,
    listMembers: vi.fn(async () => [
      { user_id: 'owner-1', email: 'dueno@example.test', role: 'owner' },
      { user_id: 'staff-1', email: 'equipo@example.test', role: 'cajero' },
    ]),
    invite: vi.fn(async () => {}), audit: vi.fn(async () => []),
  };
  return { dom, d: dom.window.document, online, ui: createOnlineUi({ online, w: dom.window }) };
}

describe('invitaciones y permisos del equipo', () => {
  it('el dueño ve campos etiquetados, vendedor por defecto y la explicación de los cinco roles', async () => {
    const a = setup(); await a.ui.renderUsers();
    const field = a.d.querySelector('#nb-inv-role');
    expect(field.value).toBe('cajero');
    expect(a.d.querySelector('label[for="nb-inv-role"]').textContent).toBe('Rol de acceso');
    expect(a.d.querySelector('label[for="nb-inv-mail"]').textContent).toBe('Correo electrónico');
    expect(a.d.querySelector('#nb-inv-permissions').textContent).toMatch(/Mostrador.*No ve costos/);
    expect([...a.d.querySelectorAll('.cloud-role-guide dt')].map(el => el.textContent)).toEqual(['Dueño', 'Administrador', 'Encargado', 'Vendedor / Caja', 'Solo lectura']);
    expect([...field.options].some(o => o.value === 'owner')).toBe(false);
    expect(a.d.querySelectorAll('select[aria-label="Rol de dueno@example.test"]')).toHaveLength(0);
    expect(a.d.querySelector('select[aria-label="Rol de equipo@example.test"]').value).toBe('cajero');
    a.dom.window.close();
  });

  it('actualiza la explicación y envía el rol elegido con el correo; conserva la confirmación', async () => {
    const a = setup(); await a.ui.renderUsers();
    a.d.querySelector('#nb-inv-mail').value = 'ventas@example.test';
    a.d.querySelector('#nb-inv-role').value = 'encargado'; a.ui.renderInviteRole();
    expect(a.d.querySelector('#nb-inv-permissions').textContent).toMatch(/stock/);
    await a.ui.invite();
    expect(a.online.invite).toHaveBeenCalledWith('ventas@example.test', 'encargado');
    expect(a.d.querySelector('#nube-users-msg').textContent).toContain('ventas@example.test como Encargado');
    expect(a.d.querySelector('#nb-inv-mail').value).toBe('');
    a.dom.window.close();
  });

  it('bloquea el doble envío mientras se crea la invitación', async () => {
    const a = setup(); let finish;
    a.online.invite.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await a.ui.renderUsers(); a.d.querySelector('#nb-inv-mail').value = 'ventas@example.test';
    const pending = a.ui.invite();
    expect(a.d.querySelector('#nb-inv-send').disabled).toBe(true);
    await a.ui.invite(); expect(a.online.invite).toHaveBeenCalledTimes(1);
    finish(); await pending;
    expect(a.d.querySelector('#nb-inv-send').disabled).toBe(false);
    a.dom.window.close();
  });

  it('conserva el correo, el rol y el error si no se puede crear la invitación', async () => {
    const a = setup(); a.online.invite.mockRejectedValue(new Error('Sin conexión.'));
    await a.ui.renderUsers(); a.d.querySelector('#nb-inv-mail').value = 'ventas@example.test';
    a.d.querySelector('#nb-inv-role').value = 'lectura'; await a.ui.invite();
    expect(a.d.querySelector('#nube-users-msg').textContent).toContain('Sin conexión.');
    expect(a.d.querySelector('#nb-inv-mail').value).toBe('ventas@example.test');
    expect(a.d.querySelector('#nb-inv-role').value).toBe('lectura');
    expect(a.d.querySelector('#nb-inv-send').disabled).toBe(false);
    a.dom.window.close();
  });

  it.each(['admin', 'encargado', 'cajero', 'lectura'])('el rol %s no consulta ni administra usuarios desde esta pantalla', async role => {
    const a = setup(role); await a.ui.renderUsers(); await a.ui.invite();
    expect(a.online.listMembers).not.toHaveBeenCalled();
    expect(a.online.invite).not.toHaveBeenCalled();
    expect(a.d.querySelector('#nb-inv-role')).toBeNull();
    a.dom.window.close();
  });

  it('informa el error al cargar el equipo, en lugar de ocultar la sección sin explicación', async () => {
    const a = setup(); a.online.listMembers.mockRejectedValue(new Error('Sin conexión.'));
    await a.ui.renderUsers(); expect(a.d.querySelector('#nube-users-msg').textContent).toMatch(/No se pudo cargar el equipo.*Sin conexión/);
    a.dom.window.close();
  });
});
