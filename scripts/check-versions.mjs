// Alinear la app y sus registros sin cambiar versiones de dependencias.
import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const tauri = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')).version;
const cargo = /^version\s*=\s*"([^"]+)"/m.exec(fs.readFileSync('src-tauri/Cargo.toml', 'utf8'))[1];
const app = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync('src/project/schema.js', 'utf8'))[1];
const npmLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const cargoLock = fs.readFileSync('src-tauri/Cargo.lock', 'utf8');
const appBlock = cargoLock.split('[[package]]').find(block => /^name = "sahten"$/m.test(block));
const lockedApp = /^version = "([^"]+)"/m.exec(appBlock || '')?.[1] || '(falta sahten)';
const all = { 'package.json': pkg, 'tauri.conf.json': tauri, 'Cargo.toml': cargo, 'schema.js (APP_VERSION)': app, 'package-lock.json': npmLock.version, 'package-lock.json (raíz)': npmLock.packages?.['']?.version || '(falta raíz)', 'Cargo.lock (sahten)': lockedApp };
const ok = new Set(Object.values(all)).size === 1;
console.log(ok ? 'Versiones en orden: ' + pkg : 'Las versiones no coinciden: ' + JSON.stringify(all));
process.exit(ok ? 0 : 1);
