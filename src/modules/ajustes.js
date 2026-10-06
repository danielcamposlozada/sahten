// Panel «ajustes» (y sus pestañas canales / personalización): una sola navegación por pestañas
import { onPanelShow } from '../events.js';

const skipTabs = () => !!window._ajSkipTabs;

export function register() {
  onPanelShow('ajustes', () => {
    if (skipTabs()) return;
    if (typeof window._ajNavTab === 'function') window._ajNavTab(window._getSavedTab('ajustes', 'personal'));
    else { window._renderAjustesTabs('personal'); }
  });
  onPanelShow('canales', () => {
    if (skipTabs()) return;
    if (typeof window._ajNavTab === 'function') window._ajNavTab('canales');
    else { window._renderAjustesTabs('canales'); window.renderChannels(); }
  });
  onPanelShow('personalizacion', () => {
    if (skipTabs()) return;
    if (typeof window._ajNavTab === 'function') window._ajNavTab('personal');
    else window._renderAjustesTabs('personal');
  });
}
