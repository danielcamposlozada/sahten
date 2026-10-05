// Registro de módulos: un archivo por panel. Cada módulo declara sus eventos (onPanelShow / onDataChanged).
import { register as dashboard } from './dashboard.js';
import { register as productos } from './productos.js';
import { register as proyeccion } from './proyeccion.js';
import { register as ventas } from './ventas.js';
import { register as stock } from './stock.js';
import { register as ingredientes } from './ingredientes.js';
import { register as envases } from './envases.js';
import { register as menuonline } from './menuonline.js';
import { register as ajustes } from './ajustes.js';
import { register as gastos } from './gastos.js';
import { register as costreceta } from './costreceta.js';
import { register as mostrador } from './mostrador.js';
import { register as reportes } from './reportes.js';
import { register as wiki } from './wiki.js';
import { register as nube } from './nube.js';

export const MODULES = { dashboard, productos, proyeccion, ventas, stock, ingredientes, envases, menuonline, ajustes, gastos, costreceta, mostrador, reportes, wiki, nube };

export function registerModules() {
  Object.values(MODULES).forEach(register => register());
}
