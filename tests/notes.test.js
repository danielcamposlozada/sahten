import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { notesToHtml } from '../src/ui/notes.js';
import { condense, notesFor } from '../scripts/release-notes.mjs';

describe('notas de actualización', () => {
  it('convierte el Markdown corto en HTML con formato y escapa todo lo demás', () => {
    const h = notesToHtml('## Novedades de 0.4.5\n\n- **Menú**: abre `la vista` <b>x</b>\n- Otro [enlace](https://x.com/a)\n\n---\nPie');
    expect(h).toContain('<h4 class="un-h">Novedades de 0.4.5</h4>'); expect(h).toContain('<ul class="un-list">');
    expect(h).toContain('<strong>Menú</strong>'); expect(h).toContain('<code>la vista</code>'); expect(h).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(h).toContain('<a href="https://x.com/a" rel="noopener noreferrer">enlace</a>'); expect(h).toContain('<p class="un-foot">Pie</p>');
    expect(h).not.toMatch(/\*\*|<b>/);
  });
  it('no deja pasar enlaces que no sean http(s)', () => {
    expect(notesToHtml('- [x](javascript:alert(1))')).not.toMatch(/<a /);
  });
  it('condensa: un renglón por cambio, primera frase, con tope por renglón y en total', () => {
    const body = '- **A**: Primera frase corta. Segunda frase que sobra.\n- **B**: ' + 'palabra '.repeat(60) + '\n' + Array.from({ length: 40 }, (_, i) => `- **C${i}**: algo que pasó número ${i}.`).join('\n');
    const c = condense(body, { maxItem: 100, maxTotal: 600 }); const lines = c.split('\n');
    expect(lines[0]).toBe('- **A**: Primera frase corta.'); expect(lines[1].length).toBeLessThanOrEqual(104); expect(lines[1]).toMatch(/…$/);
    expect(c.length).toBeLessThanOrEqual(700); expect(lines.at(-1)).toMatch(/^- …y \d+ cambios más\.$/);
  });
  it('la Release del CHANGELOG real entra en pocos renglones y trae el enlace al detalle', () => {
    const real = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    const v = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
    const n = notesFor(real, 'v' + v); expect(n).toMatch(/CHANGELOG\.md/); expect(n.length).toBeLessThan(2400);
  });
});
