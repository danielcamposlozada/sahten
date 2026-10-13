import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { notesFor } from '../scripts/release-notes.mjs';

const CL = '# Changelog\n\n## 0.4.4\n\n- **A**: uno.\n- **B**: dos.\n\n## 0.4.3\n\n- **C**: tres.\n\n## 4.0.0 — Fase D\n\n- viejo\n';
describe('notas de la Release', () => {
  it('usa la sección de esa versión (con o sin «v») y agrega el pie de instalación', () => {
    const n = notesFor(CL, 'v0.4.4');
    expect(n).toMatch(/Novedades de 0\.4\.4/); expect(n).toMatch(/\*\*A\*\*: uno/); expect(n).toMatch(/\*\*B\*\*: dos/);
    expect(n).not.toMatch(/tres/); expect(n).toMatch(/INSTALACION\.md/);
    expect(notesFor(CL, '0.4.3')).toMatch(/tres/);
    expect(notesFor(CL, 'v4.0.0')).toMatch(/viejo/);
  });
  it('versión sin sección: solo el pie; y el CHANGELOG real trae la versión actual', () => {
    expect(notesFor(CL, 'v9.9.9')).not.toMatch(/Novedades/);
    const real = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    const v = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
    expect(notesFor(real, 'v' + v)).toMatch(/Novedades de/);
  });
});
