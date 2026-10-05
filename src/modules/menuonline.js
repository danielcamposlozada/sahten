// Panel «menuonline»: render inmediato (sahten-menuonline.js agrega un segundo render diferido al mostrarlo)
import { onPanelShow } from '../events.js';

export function register() {
  onPanelShow('menuonline', () => { if (typeof window.renderMenuOnline === 'function') window.renderMenuOnline(); });
}
