// Arma una carpeta publicada de prueba (menú del demo + 2 fotos) en /tmp/site para probarla en un navegador real.
//   npx vite-node scripts/make-site.mjs [wa-number]
import fs from 'node:fs';
import { stateFromSahten } from '../src/core/projectFile.js';
import { buildMenuJson } from '../src/online/menuJson.js';
import { buildPublishFiles } from '../src/online/publish.js';
const s = stateFromSahten(JSON.parse(fs.readFileSync('samples/sahten-demo.sahten', 'utf8')));
const tienda = { address: 'Av. Siempreviva 742, Buenos Aires', lat: -34.6037, lng: -58.3816, freeShippingMin: 45000, deliveryMinOrder: 15000,
  zones: [{ id: 'z1', name: 'Zona A', type: 'circle', radiusKm: 2, baseCost: 1500 }, { id: 'z2', name: 'Zona B', type: 'circle', radiusKm: 4, baseCost: 3000 }],
  paymentMethods: { efectivo: true, transferencia: true }, bankDetails: { alias: 'sahten.pagos' } };
const imgs = { pizza_muzza: 'x', pizza_napo: 'x' };
const menu = buildMenuJson(s, { menuConfig: { whatsappNumber: process.argv[2] || '+54 9 11 5555-0123', title: 'Sahten' }, tienda, images: imgs, store: { name: 'Sahten' } });
const files = await buildPublishFiles(menu, imgs, async () => null);
files.filter(f => !f.path.startsWith('img/')).forEach(f => fs.writeFileSync('/tmp/site/' + f.path, f.data));
console.log(files.map(f => f.path), 'imágenes con referencia:', menu.products.filter(p => p.image).map(p => p.image));
