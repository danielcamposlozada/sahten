// Scooter de reparto de Sahten (ilustración vectorial propia, vista lateral).
// motoSVG() arma el dibujo; motoPose(root, t) anima ruedas, escape y balanceo de forma determinista.
(function () {
  const C = { green: '#235328', mid: '#2c6a37', light: '#3f8a4b', deep: '#183d23', darker: '#112d1b', cream: '#FFF4D6', orange: '#EF8E23', orangeDark: '#c96f10', orangeLight: '#ffb25a' };
  const star = (cx, cy, R, r) => { let d = ''; for (let i = 0; i < 16; i++) { const a = Math.PI * i / 8 - Math.PI / 2, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1); } return d + 'Z'; };
  const wheel = (id, cx, cy) => `
    <g transform="translate(${cx} ${cy})">
      <circle r="40" fill="${C.darker}"/>
      <circle r="34" fill="none" stroke="#2a3b2e" stroke-width="3" stroke-dasharray="5 7"/>
      <circle r="25" fill="${C.cream}"/>
      <g id="${id}">${[0, 72, 144, 216, 288].map(a => `<rect x="-3" y="-24" width="6" height="24" rx="3" fill="${C.mid}" transform="rotate(${a})"/>`).join('')}</g>
      <circle r="9" fill="${C.orange}"/><circle r="3.5" fill="${C.darker}"/>
    </g>`;
  window.motoSVG = (width = 360) => `
<svg viewBox="0 0 420 300" width="${width}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
  <defs>
    <linearGradient id="mBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.light}"/><stop offset="1" stop-color="${C.green}"/></linearGradient>
    <linearGradient id="mBox" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.orangeLight}"/><stop offset=".55" stop-color="${C.orange}"/></linearGradient>
    <radialGradient id="mGlow"><stop offset="0" stop-color="#fff8e1" stop-opacity=".95"/><stop offset="1" stop-color="#fff8e1" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="205" cy="272" rx="175" ry="11" fill="#000" opacity=".28"/>
  <g id="mPuffs" fill="${C.cream}">${[0, 1, 2].map(i => `<circle id="mPuff${i}" cx="40" cy="236" r="9" opacity="0"/>`).join('')}</g>
  <g id="mRide">
    <!-- escape -->
    <rect x="44" y="226" width="70" height="11" rx="5.5" fill="#5b6b5f"/><rect x="40" y="228" width="12" height="7" rx="3" fill="#2a3b2e"/>
    <!-- caja térmica con volumen -->
    <rect x="70" y="128" width="72" height="22" fill="${C.darker}"/>
    <path d="M44 58 L140 58 L156 70 L156 150 L140 140 L140 70 Z" fill="${C.orangeDark}"/>
    <rect x="44" y="58" width="96" height="84" rx="9" fill="url(#mBox)"/>
    <rect x="44" y="58" width="96" height="16" rx="8" fill="${C.orangeDark}" opacity=".55"/>
    <path d="${star(92, 102, 27, 12)}" fill="${C.cream}"/>
    <!-- carrocería trasera -->
    <path d="M58 212 C48 176 70 150 112 148 L206 148 C222 148 230 162 228 182 L224 212 Z" fill="url(#mBody)"/>
    <path d="M78 170 C92 158 120 156 200 157" fill="none" stroke="${C.cream}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    <path d="M196 166 L222 166" stroke="${C.orange}" stroke-width="8" stroke-linecap="round"/>
    <!-- piso y asiento -->
    <path d="M206 204 L272 204 L276 216 L204 216 Z" fill="${C.deep}"/>
    <path d="M118 150 C140 128 182 128 214 140 L214 152 L118 152 Z" fill="${C.darker}"/>
    <!-- guardabarros, horquilla y escudo -->
    <path d="M300 178 L330 232" stroke="${C.darker}" stroke-width="11" stroke-linecap="round"/>
    <path d="M286 202 C300 182 344 180 364 204 L358 210 C342 194 306 194 292 210 Z" fill="${C.green}"/>
    <path d="M262 214 C254 160 266 120 292 96 L312 100 C298 128 296 170 304 214 Z" fill="url(#mBody)"/>
    <path d="M272 200 C268 160 278 126 296 106" fill="none" stroke="${C.cream}" stroke-width="4" stroke-linecap="round" opacity=".5"/>
    <!-- manubrio, espejo y faro -->
    <path d="M276 90 L318 84" stroke="${C.darker}" stroke-width="9" stroke-linecap="round"/>
    <path d="M300 86 L296 62" stroke="${C.darker}" stroke-width="4"/><ellipse cx="295" cy="58" rx="9" ry="6" fill="${C.cream}" stroke="${C.darker}" stroke-width="3"/>
    <circle cx="322" cy="112" r="34" fill="url(#mGlow)"/>
    <path d="M308 100 C324 98 332 108 330 122 L312 122 Z" fill="${C.cream}" stroke="${C.darker}" stroke-width="3"/>
    ${wheel('mSpokeR', 104, 230)}
    ${wheel('mSpokeF', 330, 230)}
    <!-- repartidor -->
    <path d="M178 140 L238 152 L246 204" fill="none" stroke="${C.deep}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M232 200 L262 204" stroke="${C.darker}" stroke-width="12" stroke-linecap="round"/>
    <path d="M152 148 C148 104 168 76 202 70 C222 68 232 84 226 104 L212 148 Z" fill="${C.cream}"/>
    <path d="M206 84 C214 104 210 126 200 146" fill="none" stroke="${C.orange}" stroke-width="6"/>
    <path d="M160 120 C176 118 196 120 214 126" fill="none" stroke="${C.green}" stroke-width="5" opacity=".5"/>
    <path d="M214 90 L262 96 L282 90" fill="none" stroke="${C.cream}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="282" cy="90" r="8" fill="${C.darker}"/>
    <g id="mHead">
      <rect x="198" y="56" width="16" height="18" rx="6" fill="#d9a77a"/>
      <circle cx="210" cy="40" r="27" fill="${C.orange}"/>
      <path d="M210 13 C226 13 237 24 237 40 L222 40 C222 30 218 20 210 13 Z" fill="${C.orangeLight}" opacity=".7"/>
      <path d="M216 34 L238 34 C239 44 236 52 228 55 L214 52 Z" fill="${C.darker}"/>
      <path d="M220 38 L232 38" stroke="#5f8f9a" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      <path d="M184 42 C186 26 196 16 210 13" fill="none" stroke="${C.cream}" stroke-width="5" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
  // t en segundos; speed 0..1 (0 = detenida). Determinista: depende solo de t.
  window.motoPose = (root, t, speed = 1) => {
    const ang = (t * 900 * speed) % 360;
    root.querySelector('#mSpokeR')?.setAttribute('transform', `rotate(${ang})`);
    root.querySelector('#mSpokeF')?.setAttribute('transform', `rotate(${ang})`);
    const bob = Math.sin(t * 24) * 2.2 * speed;
    root.querySelector('#mRide')?.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) rotate(${(Math.sin(t * 12) * .6 * speed).toFixed(2)} 210 230)`);
    root.querySelector('#mHead')?.setAttribute('transform', `translate(0 ${(Math.sin(t * 24 + 1) * 1.2 * speed).toFixed(2)})`);
    for (let i = 0; i < 3; i++) {
      const u = ((t * 1.6 + i / 3) % 1), p = root.querySelector('#mPuff' + i);
      if (!p) continue;
      p.setAttribute('cx', (40 - u * 70).toFixed(1)); p.setAttribute('cy', (236 - u * 24).toFixed(1));
      p.setAttribute('r', (7 + u * 14).toFixed(1)); p.setAttribute('opacity', (speed * .55 * (1 - u)).toFixed(2));
    }
  };
})();
