// Panel «nube»: conexión opcional con Supabase, sincronización, usuarios y auditoría
import { onPanelShow } from '../events.js';

export function register() {
  onPanelShow('nube', () => { if (window.SAHTEN.online && window.SAHTEN.online.ui) window.SAHTEN.online.ui.render(); });
}
