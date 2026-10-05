// ═══════════════════════════════════════════════════════════
// Librerías locales (sin CDN: la app de escritorio funciona sin internet)
//   Chart.js y las fuentes DM Sans / DM Mono: se cargan al arrancar.
//   Leaflet y SheetJS: se cargan al primer uso (pesan) con import dinámico.
// El código legado las espera como globales (window.Chart, window.L, window.XLSX).
// ═══════════════════════════════════════════════════════════
import '@fontsource/dm-sans/300.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import 'leaflet/dist/leaflet.css';
import Chart from 'chart.js/auto';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

window.Chart = Chart;

let leafletP = null, xlsxP = null;
export const libs = {
  leaflet() {
    if (window.L) return Promise.resolve(window.L);
    return leafletP || (leafletP = import('leaflet').then(m => {
      const L = m.default || m;
      L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });
      window.L = L; return L;
    }));
  },
  xlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return xlsxP || (xlsxP = import('xlsx').then(m => { window.XLSX = m.default && m.default.read ? m.default : m; return window.XLSX; }));
  },
};
