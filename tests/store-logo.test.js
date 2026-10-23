import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { normalizeStoreLogo, validateLogoSvg } from '../src/online/logo.js';
import { normalizeSite, buildSite, exportSiteContent, parseSiteContent, applySiteContent } from '../src/online/site.js';
import { buildIndexHtml } from '../src/online/publish.js';

const Parser = new JSDOM('').window.DOMParser;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><path d="M0 0L40 0L20 20Z" fill="#fff"/></svg>';
const logo = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
it('conserva los trazos del SVG original y rechaza scripts, enlaces y contenido activo', () => {
  expect(validateLogoSvg(svg, Parser)).toBe(svg);
  for (const active of ['<script>alert(1)</script>', '<foreignObject/>', '<image href="https://other.example/a"/>', '<path onload="alert(1)"/>', '<path style="fill:url(https://other.example/x)"/>']) {
    expect(() => validateLogoSvg('<svg xmlns="http://www.w3.org/2000/svg">' + active + '</svg>', Parser)).toThrow();
  }
  expect(() => validateLogoSvg('<!DOCTYPE svg><svg/>', Parser)).toThrow();
  expect(() => validateLogoSvg('<svg><path></svg>', Parser)).toThrow();
});
it('el logo viaja con el contenido del sitio, se puede quitar y no acepta rutas locales ni URLs arbitrarias', () => {
  const s = normalizeSite({ enabled: true, logo, logoUseTextColor: true });
  expect(buildSite(s)).toMatchObject({ logo, logoUseTextColor: true });
  expect(applySiteContent({}, parseSiteContent(exportSiteContent(s)))).toMatchObject({ logo, logoUseTextColor: true });
  expect(applySiteContent(s, parseSiteContent('{"format":"sahten-sitio","site":{"logo":""}}')).logo).toBe('');
  for (const bad of ['file:///Users/me/logo.svg', 'javascript:alert(1)', 'https://other.example/a.svg', 'data:text/html;base64,AAAA', 'data:image/png;base64,' + 'a'.repeat(3000000)]) expect(normalizeStoreLogo(bad)).toBe('');
});
it('el logo personalizado tiene prioridad sobre el kit y puede usar el color del texto sin modificar el SVG', async () => {
  const menu = { store: { name: 'Mi negocio', whatsapp: '5491100000000' }, products: [], config: {}, site: { enabled: true, logo, logoUseTextColor: true, seo: { url: 'https://local.example/', brandKit: 'sahten' }, order: ['hero'], hero: { title: 'Bienvenidos', cta: 'Pedir', highlights: [] } } };
  const dom = new JSDOM(buildIndexHtml(menu), { url: 'https://local.example/', runScripts: 'dangerously', beforeParse(w) { w.scrollTo = () => {}; w.fetch = async () => ({ ok: false }); } });
  await new Promise(r => setTimeout(r, 50));
  const mark = dom.window.document.querySelector('#s-hero .brand-mask');
  expect(mark.getAttribute('aria-label')).toBe('Mi negocio');
  expect(mark.style.getPropertyValue('--logo')).toContain(logo);
  expect(dom.window.document.querySelector('#s-hero svg.brand-mark')).toBeNull();
  expect(dom.window.document.querySelector('#s-hero .btn2 svg.wa-icon')).not.toBeNull();
  expect(dom.window.document.querySelector('#fab svg.wa-icon')).not.toBeNull();
  dom.window.close();
});
