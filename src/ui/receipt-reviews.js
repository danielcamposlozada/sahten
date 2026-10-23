import googleLogo from '../assets/google-g.png?inline';
import { reviewUrl } from './review-link.js';
export { reviewUrl } from './review-link.js';
import qrcode from 'qrcode-generator';

export const DEFAULT_REVIEW_TEXT = '¿Cómo estuvo tu experiencia? Dejanos tu reseña en Google';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function reviewFooter(config = {}) {
  const url = reviewUrl(config.reviewUrl);
  if (!config.reviewEnabled || !url) return '';
  const qr = qrcode(0, 'M');
  qr.addData(url, 'Byte'); qr.make();
  const image = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true }));
  const text = String(config.reviewText || DEFAULT_REVIEW_TEXT).trim().slice(0, 140) || DEFAULT_REVIEW_TEXT;
  return '<div class="receipt-review"><div class="receipt-google-brand"><img class="receipt-google-logo" src="'+googleLogo+'" alt="Google"><span aria-hidden="true">Google</span></div><p>' + esc(text) + '</p><img class="receipt-review-qr" src="' + image + '" alt="QR para dejar una reseña en Google"><p class="receipt-review-help">Escaneá el QR para opinar</p></div>';
}
