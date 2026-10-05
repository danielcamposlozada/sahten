// La versión tiene que ser la misma en package.json, src-tauri/tauri.conf.json y src-tauri/Cargo.toml (si no, el instalador y el actualizador se confunden).
import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const tauri = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')).version;
const cargo = /^version\s*=\s*"([^"]+)"/m.exec(fs.readFileSync('src-tauri/Cargo.toml', 'utf8'))[1];
const app = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync('src/project/schema.js', 'utf8'))[1];
const all = { 'package.json': pkg, 'tauri.conf.json': tauri, 'Cargo.toml': cargo, 'schema.js (APP_VERSION)': app };
const ok = new Set(Object.values(all)).size === 1;
console.log(ok ? 'Versiones en orden: ' + pkg : 'Las versiones no coinciden: ' + JSON.stringify(all));
process.exit(ok ? 0 : 1);
