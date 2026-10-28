import { afterRender } from '../events.js';
import './product-advanced.css';

export function installAdvancedProductTable(w) {
  const d = w.document;
  const table = d.querySelector('#panel-productos .prod-table'), viewport = table?.parentElement;
  if (!viewport) return;
  viewport.id = 'product-advanced-scroll'; viewport.classList.add('product-advanced-scroll');
  viewport.tabIndex = 0; viewport.setAttribute('role', 'region'); viewport.setAttribute('aria-label', 'Tabla avanzada de precios. Desplazamiento horizontal; producto fijo.');
  viewport.setAttribute('aria-describedby', 'product-advanced-help');
  const tools = d.createElement('div'); tools.className = 'product-advanced-tools';
  tools.innerHTML = '<span id="product-advanced-help">Todas tus columnas · Producto y acciones fijos al desplazar</span><div><button class="btn" data-product-scroll="-1" aria-label="Ver columnas anteriores">←</button><span data-product-scroll-state role="status" aria-live="polite">Inicio</span><button class="btn" data-product-scroll="1" aria-label="Ver columnas siguientes">→</button></div>';
  viewport.before(tools);
  function update() {
    if (viewport.clientWidth) viewport.style.maxHeight = Math.max(180, w.innerHeight - Math.max(0, viewport.getBoundingClientRect().top) - 20) + 'px';
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth), atStart = viewport.scrollLeft < 2, atEnd = viewport.scrollLeft >= max - 2;
    tools.querySelector('[data-product-scroll="-1"]').disabled = atStart;
    tools.querySelector('[data-product-scroll="1"]').disabled = atEnd;
    tools.querySelector('[data-product-scroll-state]').textContent = max <= 2 ? 'Todo visible' : atStart ? 'Inicio' : atEnd ? 'Final' : 'Más columnas';
    viewport.classList.toggle('is-scrolled', !atStart); viewport.classList.toggle('has-more-columns', !atEnd);
  }
  tools.addEventListener('click', e => { const button = e.target.closest('[data-product-scroll]'); if (!button) return; viewport.scrollBy({ left: Number(button.dataset.productScroll) * Math.max(240, viewport.clientWidth * .65), behavior: w.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
  viewport.addEventListener('scroll', update, { passive: true }); w.addEventListener('resize', update);
  afterRender('renderProductos', update);
}
