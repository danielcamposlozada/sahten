// i18n mínimo: t('clave', { param }) con respaldo en es-AR. Para sumar un idioma: crear src/i18n/<locale>.js y registrarlo.
import esAR from './es-AR.js';

const dictionaries = { 'es-AR': esAR };
let current = 'es-AR';

export function registerLocale(locale, dict) { dictionaries[locale] = dict; }
export function setLocale(locale) { if (dictionaries[locale]) current = locale; return current; }
export function getLocale() { return current; }

export function t(key, params) {
  const raw = (dictionaries[current] && dictionaries[current][key]) ?? dictionaries['es-AR'][key] ?? key;
  return params ? raw.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : '')) : raw;
}
