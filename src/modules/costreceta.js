// Panel «costreceta»: qué se dibuja al mostrarlo (la UI sigue en src/legacy hasta migrarla panel por panel)
import { onPanelShow } from '../events.js';

export function register() {
  onPanelShow('costreceta', () => {
    window.renderCostReceta();
  });
}
