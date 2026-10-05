// Configuración de instaladores: no se puede compilar Rust en los tests, pero sí verificar que las piezas coincidan entre sí.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { root } from './helpers.js';

const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const tauri = json('src-tauri/tauri.conf.json'), caps = json('src-tauri/capabilities/default.json'), pkg = json('package.json');
const cargo = read('src-tauri/Cargo.toml'), lib = read('src-tauri/src/lib.rs'), integ = read('src/desktop/integration.js');

describe('instaladores (Tauri)', () => {
  it('la versión es la misma en package.json, tauri.conf.json, Cargo.toml y el formato .sahten', () => {
    const cargoV = /^version\s*=\s*"([^"]+)"/m.exec(cargo)[1], app = /APP_VERSION = '([^']+)'/.exec(read('src/project/schema.js'))[1];
    expect(new Set([pkg.version, tauri.version, cargoV, app]).size).toBe(1);
    expect(tauri.version).toMatch(/^\d+\.\d+\.\d+$/);               // el MSI no admite sufijos tipo -alpha
  });
  it('asocia la extensión .sahten y apunta al build web', () => {
    expect(tauri.bundle.fileAssociations[0].ext).toEqual(['sahten']);
    expect(tauri.build.frontendDist).toBe('../dist'); expect(tauri.build.beforeBuildCommand).toBe('npm run build');
    expect(tauri.identifier).toMatch(/^[a-z0-9.]+$/);
  });
  it('actualizador: clave pública minisign válida, endpoint HTTPS de GitHub Releases y artefactos firmados', () => {
    const pub = Buffer.from(tauri.plugins.updater.pubkey, 'base64').toString('utf8');
    expect(pub).toMatch(/^untrusted comment: minisign public key/);
    expect(tauri.plugins.updater.endpoints[0]).toMatch(/^https:\/\/github\.com\/.+\/releases\/latest\/download\/latest\.json$/);
    expect(tauri.bundle.createUpdaterArtifacts).toBe(true);
  });
  it('los íconos declarados existen', () => { tauri.bundle.icon.forEach(i => expect(fs.existsSync(path.join(root, 'src-tauri', i)), i).toBe(true)); });
  it('cada plugin que usa la interfaz está en Cargo.toml, registrado en Rust y con permiso en las capabilities', () => {
    const plugins = { dialog: 'tauri-plugin-dialog', fs: 'tauri-plugin-fs', store: 'tauri-plugin-store', opener: 'tauri-plugin-opener', process: 'tauri-plugin-process', updater: 'tauri-plugin-updater' };
    const perms = caps.permissions.map(p => (typeof p === 'string' ? p : p.identifier));
    Object.entries(plugins).forEach(([name, crate]) => {
      expect(cargo).toContain(crate);
      expect(lib).toContain(crate.replace(/-/g, '_'));
      expect(perms.some(p => p.startsWith(name + ':')), name).toBe(true);
      expect(Object.keys(pkg.dependencies)).toContain('@tauri-apps/plugin-' + name);
    });
    expect(cargo).toContain('tauri-plugin-single-instance');
  });
  it('el nombre del comando y del evento coinciden entre Rust y la interfaz', () => {
    expect(lib).toContain('fn take_pending_file'); expect(lib).toContain('generate_handler![take_pending_file]'); expect(integ).toContain("invoke('take_pending_file')");
    expect(lib).toContain('"open-file"'); expect(integ).toContain("listen('open-file'");
  });
  it('permisos de archivos: lo que usa el adaptador y las rutas ocultas de los respaldos', () => {
    const perms = caps.permissions.map(p => (typeof p === 'string' ? p : p.identifier));
    ['fs:allow-read-text-file', 'fs:allow-write-text-file', 'fs:allow-write-file', 'fs:allow-rename', 'fs:allow-remove', 'fs:allow-read-dir', 'fs:allow-mkdir', 'dialog:allow-open', 'dialog:allow-save', 'process:allow-restart', 'opener:allow-reveal-item-in-dir'].forEach(p => expect(perms).toContain(p));
    expect(tauri.plugins.fs.requireLiteralLeadingDot).toBe(false);          // sin esto el alcance `**` no incluye los archivos .<nombre>.backup-…
  });
  it('CI: .dmg universal (macOS) y .msi/.exe (Windows) con tauri-action y firma del actualizador', () => {
    const rel = read('.github/workflows/release.yml');
    expect(rel).toContain('universal-apple-darwin'); expect(rel).toContain('windows-latest'); expect(rel).toContain('tauri-apps/tauri-action');
    expect(rel).toContain('TAURI_SIGNING_PRIVATE_KEY'); expect(rel).toContain('includeUpdaterJson: true'); expect(rel).toContain("tags: ['v*']");
    expect(rel).toContain('npm test');
  });
  it('la clave PRIVADA del actualizador no está en el repositorio', () => {
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === 'node_modules' || e.name === '.git' || e.name === 'target' || e.name === '.tmp' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const files = walk(root).filter(f => !/\.(png|ico|icns|jpg|woff2?|xlsx|pdf|svg)$/i.test(f) && fs.statSync(f).size < 2e6);
    const secret = 'minisign encrypted ' + 'secret key';                 // armado en dos partes para que este archivo no se detecte a sí mismo
    const leaked = files.filter(f => fs.readFileSync(f, 'utf8').includes(secret));
    expect(leaked.map(f => path.relative(root, f))).toEqual([]);
  });
});

describe('build web / PWA sin CDN', () => {
  it('el build no depende de ningún servidor externo para cargar la app (fuentes, Chart.js, Leaflet, SheetJS)', async () => {
    const out = path.join(root, '.tmp/dist-check');
    fs.rmSync(out, { recursive: true, force: true });
    await build({ root, configFile: path.join(root, 'vite.config.js'), logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    const external = (html.match(/(?:src|href)="https?:\/\/[^"]+/g) || []);
    expect(external).toEqual([]);
    const css = fs.readdirSync(path.join(out, 'assets')).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(out, 'assets', f), 'utf8')).join('\n');
    expect(css).not.toMatch(/url\(\s*['"]?https?:/); expect(css).not.toMatch(/@import\s+url\(\s*['"]?https?:/);
    const js = fs.readdirSync(path.join(out, 'assets')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(out, 'assets', f), 'utf8')).join('\n');
    ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.sheetjs.com'].forEach(h => expect(js, h).not.toContain(h));
    expect(fs.readdirSync(path.join(out, 'assets')).some(f => f.endsWith('.woff2'))).toBe(true);      // las fuentes viajan en el build
    expect(fs.existsSync(path.join(out, 'manifest.webmanifest'))).toBe(true); expect(fs.existsSync(path.join(out, 'sw.js'))).toBe(true);
  }, 120000);
  it('PWA: manifiesto con íconos que existen, y el service worker no toca pedidos a otros orígenes', () => {
    const m = json('public/manifest.webmanifest');
    m.icons.forEach(i => expect(fs.existsSync(path.join(root, 'public', i.src)), i.src).toBe(true));
    expect(m.display).toBe('standalone'); expect(m.start_url).toBe('./');
    expect(read('public/sw.js')).toMatch(/url\.origin !== self\.location\.origin\) return/);
  });
  it('Leaflet y SheetJS se cargan bajo demanda desde el paquete (no por CDN)', () => {
    expect(read('src/legacy/sahten-tienda.js')).toContain('SAHTEN.libs.leaflet()');
    expect(read('src/legacy/sahten-reportes.js')).toContain('SAHTEN.libs.xlsx()');
    expect(read('src/libs.js')).toContain("import('leaflet')"); expect(read('src/libs.js')).toContain("import('xlsx')");
  });
});
