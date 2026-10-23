import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import jsQR from 'jsqr';
import { reviewUrl, reviewFooter, DEFAULT_REVIEW_TEXT } from '../src/ui/receipt-reviews.js';
describe('reseñas de Google en el ticket', () => {
  it('solo habilita enlaces HTTPS de Google y no imprime un QR vacío', () => {
    expect(reviewUrl(' https://g.page/r/ejemplo/review ')).toBe('https://g.page/r/ejemplo/review');
    expect(reviewUrl('https://maps.app.goo.gl/ejemplo')).toBeTruthy();
    for (const url of ['javascript:alert(1)', 'https://google.com.evil.test/review', 'https://google.com@evil.test', 'http://g.page/r/x', 'https://g.page:444/x']) expect(reviewUrl(url)).toBeNull();
    expect(reviewFooter({ reviewEnabled: true })).toBe('');
    expect(reviewFooter({ reviewUrl: 'https://g.page/r/ejemplo/review' })).toBe('');
  });
  it('genera un QR vectorial sin servicios externos y escapa el texto editable', () => {
    const html = reviewFooter({ reviewEnabled: true, reviewUrl: 'https://g.page/r/ejemplo/review', reviewText: '<script>hola</script>' });
    const d = new JSDOM(html).window.document;
    expect(d.querySelector('script')).toBeNull();
    expect(d.querySelector('p').textContent).toBe('<script>hola</script>');
    const svg = decodeURIComponent(d.querySelector('img').src.split(',')[1]);
    expect(svg).toContain('<svg'); expect(svg).toContain('<path');
    // Rasteriza los módulos del SVG para comprobar el destino con un lector independiente.
    const size = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (const [,x,y,side] of svg.matchAll(/M(\d+),(\d+)l(\d+),0/g)) {
      for (let row=+y;row<+y+(+side);row++) for(let col=+x;col<+x+(+side);col++) {
        const at=(row*size+col)*4; pixels[at]=pixels[at+1]=pixels[at+2]=0;
      }
    }
    expect(jsQR(pixels,size,size).data).toBe('https://g.page/r/ejemplo/review');
    expect(reviewFooter({ reviewEnabled: true, reviewUrl: 'https://g.page/r/ejemplo/review' })).toContain(DEFAULT_REVIEW_TEXT);
  });
});
