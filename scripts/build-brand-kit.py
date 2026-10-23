#!/usr/bin/env python3
"""Genera el kit de imágenes de marca de Sahten.

Fuentes (docs/brand/sahten/source/):
  logo-lockup-gastronomia-arabe.svg  logo vectorial con el texto «GASTRONOMÍA ÁRABE» (tipografía AUDREY, ya en curvas)
  panel-variantes.svg                panel de colores aprobado por la marca (solo se usan las 4 variantes con letras SÓLIDAS)
Uso:  pip install cairosvg pillow && python3 scripts/build-brand-kit.py
Salida:
  docs/brand/sahten/export/   → todo el kit (web + perfiles sociales + Google Business Profile)
  src/online/brand/sahten.js  → los archivos que viajan en «Publicar menú» (base64), consumido por src/online/brand.js
"""
import base64, io, re, json, pathlib
import cairosvg
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/brand/sahten/source/logo-lockup-gastronomia-arabe.svg'
OUT = ROOT / 'docs/brand/sahten/export'
JS = ROOT / 'src/online/brand/sahten.js'
GREEN, ORANGE, CREAM = '#235328', '#EF8E23', '#FFF4D6'   # colores del panel de marca
INTER = 'Inter, Liberation Sans, DejaVu Sans, sans-serif'     # solo para textos sueltos; el logo y su tagline van en curvas

paths = [d for d, _ in re.findall(r'<path d="([^"]+)" fill="(#[0-9A-Fa-f]+)"/>', SRC.read_text())]
assert len(paths) == 29, 'el logo debería tener 29 trazos: 5 letras, 5 rombos, 1 caligrafía y 18 de tagline'
LETTERS, DIAMONDS, SCRIPT, TAGLINE = paths[0:5], paths[5:10], paths[10:11], paths[11:]
WORDMARK_BOX, LOCKUP_BOX = (0, 0, 1249, 680), (0, 0, 1249, 778)

# Variantes sólidas del panel: (fondo, letras, detalles: rombos + caligrafía)
VARIANTS = {'verde-naranja': (GREEN, ORANGE, CREAM), 'crema-verde': (CREAM, GREEN, ORANGE), 'naranja-verde': (ORANGE, GREEN, CREAM), 'crema-naranja': (CREAM, ORANGE, GREEN)}

def logo(variant, tagline=True):
    _, letters, accent = VARIANTS[variant]
    f = lambda ds, c: ''.join(f'<path d="{d}" fill="{c}"/>' for d in ds)
    return f(LETTERS, letters) + f(DIAMONDS + SCRIPT, accent) + (f(TAGLINE, letters) if tagline else '')

def wrap(w, h, inner, bg=None, radius=0):
    r = f'<rect width="{w}" height="{h}" rx="{radius}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{r}{inner}</svg>'

def place(body, box, cx, cy, width):
    """Centra `body` (caja de origen `box`) en (cx, cy) con el ancho dado."""
    bx, by, bw, bh = box; k = width / bw
    return f'<g transform="translate({cx - (bx + bw / 2) * k:.2f} {cy - (by + bh / 2) * k:.2f}) scale({k:.5f})">{body}</g>'

def text(x, y, s, size, fill, weight=700, spacing=0):
    return f'<text x="{x}" y="{y}" font-family="{INTER}" font-size="{size}" font-weight="{weight}" letter-spacing="{spacing}" fill="{fill}" text-anchor="middle">{s}</text>'

def png_bytes(w, h, inner, bg, radius=0):
    data = cairosvg.svg2png(bytestring=wrap(w, h, inner, bg, radius).encode(), output_width=w, output_height=h)
    buf = io.BytesIO(); Image.open(io.BytesIO(data)).convert('RGBA').save(buf, 'PNG', optimize=True); return buf.getvalue()

OUT.mkdir(parents=True, exist_ok=True); JS.parent.mkdir(parents=True, exist_ok=True)
for old in OUT.glob('*'): old.unlink()
PUB = {}   # archivos que se publican: ruta → bytes
def save(name, data, publish=None):
    (OUT / name).write_bytes(data)
    if publish: PUB[publish] = data

# ── Logos vectoriales: 4 variantes sólidas, con y sin tagline, fondo transparente y sobre su color ──
for v, (bg, _, _) in VARIANTS.items():
    for tag, box, label in ((True, LOCKUP_BOX, 'con-tagline'), (False, WORDMARK_BOX, 'sin-tagline')):
        body = logo(v, tag); w, h = box[2], box[3]
        save(f'sahten-logo-{v}-{label}-transparente.svg', wrap(w, h, body).encode())
        pad = 140
        save(f'sahten-logo-{v}-{label}-sobre-fondo.svg', wrap(w + 2 * pad, h + 2 * pad, f'<g transform="translate({pad} {pad})">{body}</g>', bg).encode())

# ── Caligrafía sola (صَحْتَيْن): para el encabezado de la web y donde el wordmark no entra. Se puede escalar libremente: es vector ──
CALLI_VB = (152, 259, 944, 204)   # caja ajustada de la caligrafía dentro del logo (x, y, ancho, alto)
for name, color in (('crema', CREAM), ('naranja', ORANGE), ('verde', GREEN)):
    vb = ' '.join(map(str, CALLI_VB))
    save(f'sahten-caligrafia-{name}-transparente.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{CALLI_VB[2]}" height="{CALLI_VB[3]}"><path d="{SCRIPT[0]}" fill="{color}"/></svg>'.encode())
def calli(size, ratio):
    bx, by, bw, bh = CALLI_VB
    return place(f'<path d="{SCRIPT[0]}" fill="{ORANGE}"/>', CALLI_VB, size / 2, size / 2, size * ratio)
save('sahten-avatar-caligrafia-1080.png', png_bytes(1080, 1080, calli(1080, 0.78), GREEN))   # alternativa de avatar: solo la caligrafía

# ── Íconos: verde de marca, letras naranjas, detalles crema (solo el wordmark, sin tagline: a 32 px no se lee) ──
def icon_svg(size, ratio, radius=0):
    return wrap(size, size, place(logo('verde-naranja', False), WORDMARK_BOX, size / 2, size / 2, size * ratio), GREEN, radius)
save('favicon.svg', icon_svg(512, 0.86, 96).encode(), 'favicon.svg')
def icon(size, ratio, name, publish=None):
    data = png_bytes(size, size, place(logo('verde-naranja', False), WORDMARK_BOX, size / 2, size / 2, size * ratio), GREEN)
    save(name, data, publish); return data
icon(32, 0.92, 'favicon-32x32.png')
big = Image.open(io.BytesIO(icon(256, 0.92, '_ico.png'))); (OUT / '_ico.png').unlink()
big.save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)]); PUB['favicon.ico'] = (OUT / 'favicon.ico').read_bytes()
icon(180, 0.84, 'apple-touch-icon.png', 'apple-touch-icon.png')                      # iOS le pone las esquinas redondeadas
icon(192, 0.84, 'sahten-icon-192.png', 'brand/sahten-icon-192.png')
icon(512, 0.84, 'sahten-icon-512.png', 'brand/sahten-icon-512.png')
icon(512, 0.66, 'sahten-icon-maskable-512.png', 'brand/sahten-icon-maskable-512.png')   # zona segura del 80 % (Android recorta)

# ── Imagen al compartir el link (Open Graph / Twitter) 1200×630: crema, para que se destaque en WhatsApp, Facebook, X y Google ──
og = (place(logo('crema-verde', True), LOCKUP_BOX, 600, 270, 640)
      + text(600, 530, 'Comida árabe en Vicente López', 44, GREEN, 700)
      + text(600, 582, 'Retiro y delivery · sahten.online', 30, '#B86A0C', 600))   # naranja oscurecido: legible sobre crema
save('sahten-comida-arabe-og-1200x630.png', png_bytes(1200, 630, og, CREAM), 'brand/sahten-comida-arabe-og-1200x630.png')

# ── Perfiles sociales y Google Business Profile ──
avatar = lambda s: place(logo('verde-naranja', False), WORDMARK_BOX, s / 2, s / 2, s * 0.76)   # entra en el recorte circular
save('sahten-avatar-1080.png', png_bytes(1080, 1080, avatar(1080), GREEN))                      # Instagram, Facebook, WhatsApp Business, TripAdvisor
save('sahten-gbp-logo-720x720.png', png_bytes(720, 720, avatar(720), GREEN))
save('sahten-gbp-portada-1920x1080.png', png_bytes(1920, 1080, place(logo('verde-naranja', True), LOCKUP_BOX, 960, 440, 1100) + text(960, 900, 'Comida árabe casera en Vicente López', 58, CREAM, 600), GREEN))
save('sahten-facebook-portada-1640x624.png', png_bytes(1640, 624, place(logo('verde-naranja', True), LOCKUP_BOX, 820, 312, 640), GREEN))

# ── Manifiesto del sitio publicado ──
manifest = {'name': 'SAHTEN Gastronomía Árabe', 'short_name': 'Sahten', 'description': 'Comida árabe casera en Vicente López: pedí online con retiro o delivery.',
            'lang': 'es-AR', 'start_url': './', 'scope': './', 'display': 'browser', 'background_color': GREEN, 'theme_color': GREEN,
            'icons': [{'src': 'brand/sahten-icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'brand/sahten-icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                      {'src': 'brand/sahten-icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}
save('site.webmanifest', json.dumps(manifest, indent=1, ensure_ascii=False).encode(), None); PUB['site.webmanifest'] = json.dumps(manifest, ensure_ascii=False).encode()

# ── Módulo para «Publicar menú» ──
lines = ['// Generado por scripts/build-brand-kit.py — no editar a mano. Archivos del kit de marca de Sahten (base64) que se publican en la raíz del sitio.', 'export const SAHTEN_BRAND_FILES = {']
lines += [f'  {json.dumps(p)}: {json.dumps(base64.b64encode(b).decode())},' for p, b in sorted(PUB.items())]
lines += ['};', '', '// Caligrafía sola en vector, para el encabezado de la web (se incrusta en index.html: funciona también en la vista previa).',
          f'export const SAHTEN_CALLIGRAPHY = {json.dumps({"viewBox": " ".join(map(str, CALLI_VB)), "d": SCRIPT[0]})};', '']
JS.write_text('\n'.join(lines))
print('ok', len(list(OUT.glob('*'))), 'archivos;', {k: len(v) for k, v in PUB.items()})
