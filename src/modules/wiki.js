// Panel «wiki»: qué se dibuja al mostrarlo (la UI sigue en src/legacy hasta migrarla panel por panel)
import { onPanelShow } from '../events.js';

export function register() {
  onPanelShow('wiki', () => {
    setTimeout(window.wkCalc, 50);
  });
}
