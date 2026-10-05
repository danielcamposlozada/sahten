// Panel «mostrador»: restaura la pestaña guardada y dibuja
import { onPanelShow } from '../events.js';

export function register() {
  onPanelShow('mostrador', () => {
    if (typeof window.mostradorTab !== 'undefined') window.mostradorTab = window._getSavedTab('mostrador', 'pedido');
    window.renderMostrador();
  });
}
