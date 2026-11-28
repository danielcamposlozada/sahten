import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../media/sahten-editorial/analytics.js', import.meta.url), 'utf8');
const id = 'G-TEST123';

function setup(host = 'sahten.online', choice) {
  const dom = new JSDOM(`<body data-editorial-shell="pedir">
    <a id="fab" href="https://wa.me/123?text=private">Contacto</a>
    <a data-whatsapp-placement="checkout_retry" href="https://wa.me/123?text=private">Reintento</a>
    <section id="s-catering"><a href="https://api.whatsapp.com/send?text=private">Catering</a></section>
    <a href="https://wa.me.example.org/">Ajeno</a>
    <footer class="sahten-footer"></footer>
  </body>`, { url: `https://${host}/pedir/?utm_source=google&mp_checkout=private#secret`, runScripts: 'dangerously' });
  const { window } = dom;
  if (choice) window.localStorage.setItem('sahten.analytics.consent', choice);
  const { document } = window;
  const tag = document.createElement('script');
  tag.dataset.measurementId = id;
  tag.textContent = script;
  document.body.append(tag);
  document.addEventListener('click', event => {
    if (event.target.closest('a')) event.preventDefault();
  });
  return {
    window, document,
    click: selector => document.querySelector(selector).click(),
    events: () => (window.dataLayer || []).map(entry => Array.from(entry)).filter(entry => entry[0] === 'event'),
    close: () => window.close(),
  };
}

describe('GA4 de sahten.online', () => {
  it('activa analítica al aceptar, mide WhatsApp y checkout, y respeta revocación', () => {
    const { window, document, click, events, close } = setup();
    try {
      click('#fab');
      expect(window.dataLayer).toBeUndefined();
      click('[data-choice="denied"]');
      expect(window.localStorage.getItem('sahten.analytics.consent')).toBe('denied');
      click('.sahten-analytics-preferences');
      click('[data-choice="granted"]');
      click('#fab');
      click('[data-whatsapp-placement]');
      click('#s-catering a');
      click('a[href*="example.org"]');
      window.sahtenAnalytics.beginCheckout();
      window.sahtenAnalytics.orderReceived();
      window.sahtenAnalytics.whatsapp('checkout');
      expect(events()).toEqual([
        ['event', 'page_view', { send_to: id }],
        ['event', 'whatsapp_click', { send_to: id, placement: 'floating', contact_intent: 'contact' }],
        ['event', 'whatsapp_click', { send_to: id, placement: 'checkout_retry', contact_intent: 'order' }],
        ['event', 'whatsapp_click', { send_to: id, placement: 'catering', contact_intent: 'catering' }],
        ['event', 'begin_checkout', { send_to: id }],
        ['event', 'order_received', { send_to: id }],
        ['event', 'whatsapp_click', { send_to: id, placement: 'checkout', contact_intent: 'order' }],
      ]);
      expect(window.dataLayer.find(row => row[0] === 'config')[2].page_location)
        .toBe('https://sahten.online/pedir/?utm_source=google');
      expect(JSON.stringify(window.dataLayer)).not.toMatch(/private|secret/);
      click('.sahten-analytics-preferences');
      click('[data-choice="denied"]');
      click('#fab');
      expect(events()).toHaveLength(7);
      expect(window['ga-disable-' + id]).toBe(true);
      expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
    } finally { close(); }
  });

  it('publica el espacio del aviso solo mientras está visible', () => {
    const { document, click, close } = setup();
    const root = document.documentElement;
    try {
      expect(root.classList.contains('sahten-analytics-notice-open')).toBe(true);
      expect(root.style.getPropertyValue('--sahten-analytics-notice-space')).toMatch(/^\d+px$/);
      click('[data-choice="denied"]');
      expect(root.classList.contains('sahten-analytics-notice-open')).toBe(false);
      expect(root.style.getPropertyValue('--sahten-analytics-notice-space')).toBe('0px');
      click('.sahten-analytics-preferences');
      expect(root.classList.contains('sahten-analytics-notice-open')).toBe(true);
    } finally { close(); }
  });

  it('recupera el consentimiento en el dominio autorizado y excluye vistas previas', () => {
    const production = setup('sahten.online', 'granted');
    const preview = setup('preview.pages.dev', 'granted');
    try {
      expect(production.events()).toEqual([['event', 'page_view', { send_to: id }]]);
      expect(preview.window.sahtenAnalytics).toBeUndefined();
      expect(preview.events()).toEqual([]);
    } finally {
      production.close();
      preview.close();
    }
  });
});

describe('aviso de analítica: barra inferior táctil', () => {
  const css = readFileSync(new URL('../media/sahten-editorial/analytics.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = selector => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp('(?:^|})\\s*' + escaped + '\\s*\\{([^}]*)\\}'));
    if (!match) throw new Error('Falta la regla ' + selector);
    return Object.fromEntries(match[1].split(';')
      .map(part => part.split(/:(.*)/s).map(text => text.trim())).filter(([name]) => name));
  };
  const px = value => {
    const number = parseFloat(value);
    return /rem$/.test(value) ? number * 16 : number;
  };
  const fontSize = shorthand => px(shorthand.split(/\s+/).find(token => /^[\d.]+(px|rem)/.test(token)).split('/')[0]);

  it('queda fija en el borde inferior y respeta el área segura', () => {
    const notice = rule('.sahten-analytics-notice');
    expect(notice.position).toBe('fixed');
    expect(px(notice.bottom)).toBe(0);
    expect(notice.top).toBeUndefined();
    expect(notice.padding).toMatch(/env\(safe-area-inset-bottom/);
    expect(Number(notice['z-index'])).toBeGreaterThan(8);
    expect(Number(notice['z-index'])).toBeLessThan(20);
    expect(fontSize(notice.font)).toBeGreaterThanOrEqual(12);
  });

  it('cada botón tiene al menos 44×44 px y texto de 12 px o más', () => {
    const button = rule('.sahten-analytics-notice button');
    expect(px(button['min-height'])).toBeGreaterThanOrEqual(44);
    expect(px(button['min-width'])).toBeGreaterThanOrEqual(44);
    expect(fontSize(button.font)).toBeGreaterThanOrEqual(12);
    const denied = rule('.sahten-analytics-notice button[data-choice="denied"]');
    expect(denied['font-size']).toBeUndefined();
  });

  it('sube el carrito y WhatsApp mientras el aviso está abierto', () => {
    expect(rule('html.sahten-analytics-notice-open .bar,\nhtml.sahten-analytics-notice-open .fab').translate)
      .toMatch(/var\(--sahten-analytics-notice-space/);
    expect(rule('html.sahten-analytics-notice-open')['padding-bottom'])
      .toMatch(/var\(--sahten-analytics-notice-space/);
  });
});
