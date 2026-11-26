// Vespa de reparto de Sahten en 3D (Three.js), con colores planos (toon) y contorno.
// createVespa(canvas) → { render(t, headingDeg, elevationDeg, speed) }
//   headingDeg: dirección de avance EN PANTALLA (0 = hacia arriba, 90 = hacia la derecha).
//   elevationDeg: altura de la cámara (90 = vista cenital). Todo es determinista.
import * as THREE from 'three';

const COL = { body: 0xfff4d6, bodyShade: 0xe8d9b0, green: 0x2c6a37, greenDark: 0x1d4a26, deep: 0x183d23, line: 0x0d2414, cream: 0xfff4d6, orange: 0xef8e23, orangeDark: 0xc96f10, skin: 0xd9a77a, metal: 0x9aa79c, tire: 0x1b261e };

function toonGradient() {
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#EF8E23'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#FFF4D6'; g.beginPath();
  for (let i = 0; i < 16; i++) { const a = Math.PI * i / 8 - Math.PI / 2, r = i % 2 ? 40 : 92; g[i ? 'lineTo' : 'moveTo'](128 + r * Math.cos(a), 128 + r * Math.sin(a)); }
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createVespa(canvas, { size = 620 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(size, size, false); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, .1, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.1); sun.position.set(2, 4, 3); scene.add(sun);
  const grad = toonGradient();
  const mat = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra });
  const outlineMat = new THREE.MeshBasicMaterial({ color: COL.line, side: THREE.BackSide });

  const root = new THREE.Group(); scene.add(root);      // gira con el rumbo
  const bike = new THREE.Group(); root.add(bike);       // balanceo
  const add = (geo, material, pos = [0, 0, 0], rot = [0, 0, 0], parent = bike, outline = 1.06) => {
    const m = new THREE.Mesh(geo, material); m.position.set(...pos); m.rotation.set(...rot); parent.add(m);
    if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(outline); m.add(o); }
    return m;
  };

  // Ruedas (giran en el plano XY, eje Z)
  const wheels = [];
  for (const x of [-.56, .64]) {
    const w = new THREE.Group(); w.position.set(x, .21, 0); bike.add(w);
    add(new THREE.TorusGeometry(.155, .062, 14, 32), mat(COL.tire), [0, 0, 0], [0, 0, 0], w, 1.05);
    add(new THREE.CylinderGeometry(.1, .1, .07, 24), mat(COL.cream), [0, 0, 0], [Math.PI / 2, 0, 0], w, 0);
    const spokes = new THREE.Group(); w.add(spokes);
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(.022, .1, .08), mat(COL.green), [Math.sin(i * 1.2566) * .05, Math.cos(i * 1.2566) * .05, 0], [0, 0, -i * 1.2566], spokes, 0);
    add(new THREE.CylinderGeometry(.035, .035, .1, 16), mat(COL.orange), [0, 0, 0], [Math.PI / 2, 0, 0], w, 0);
    wheels.push(spokes);
  }
  // Carrocería trasera bombé (forma Vespa)
  const cowl = add(new THREE.SphereGeometry(.5, 32, 20), mat(COL.body), [-.34, .46, 0]); cowl.scale.set(1.02, .48, .6);
  add(new THREE.BoxGeometry(.5, .05, .02), mat(COL.green), [-.36, .5, .3], [0, 0, 0], bike, 0);
  add(new THREE.BoxGeometry(.5, .05, .02), mat(COL.green), [-.36, .5, -.3], [0, 0, 0], bike, 0);
  // Piso, escudo y dirección
  add(new THREE.BoxGeometry(.62, .06, .36), mat(COL.greenDark), [.15, .25, 0]);
  const shield = add(new THREE.CylinderGeometry(.24, .2, .74, 24, 1, false, -Math.PI / 2, Math.PI), mat(COL.body), [.5, .6, 0], [0, 0, -.22]);
  shield.scale.set(.42, 1.12, 1.02);
  add(new THREE.CylinderGeometry(.032, .032, .58, 12), mat(COL.metal), [.6, .48, 0], [0, 0, -.22], bike, 0);
  add(new THREE.SphereGeometry(.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(COL.body), [.64, .24, 0], [0, 0, -.1]).scale.set(1.15, .9, .75);
  add(new THREE.CapsuleGeometry(.075, .42, 6, 16), mat(COL.body), [.56, 1.02, 0], [Math.PI / 2, 0, 0]);
  for (const z of [-.22, .22]) { add(new THREE.CylinderGeometry(.012, .012, .2, 6), mat(COL.metal), [.52, 1.14, z], [0, 0, .15], bike, 0); add(new THREE.SphereGeometry(.055, 16, 10), mat(COL.cream), [.5, 1.25, z], [0, 0, 0], bike, 1.15).scale.set(.5, 1, 1); }
  add(new THREE.CylinderGeometry(.08, .08, .06, 24), mat(COL.cream, { emissive: 0xfff1c4, emissiveIntensity: .7 }), [.64, 1.03, 0], [0, 0, Math.PI / 2], bike, 1.12);
  for (const z of [-.3, .3]) add(new THREE.CylinderGeometry(.024, .024, .12, 10), mat(COL.line), [.54, 1.02, z], [Math.PI / 2, 0, 0], bike, 0);
  // Asiento
  add(new THREE.CapsuleGeometry(.12, .42, 8, 16), mat(COL.deep), [-.24, .72, 0], [0, 0, Math.PI / 2]).scale.set(1, 1, 1.2);
  // Caja térmica con la estrella en los lados
  const star = new THREE.MeshToonMaterial({ map: starTexture(), gradientMap: grad });
  const boxMats = [mat(COL.orange), mat(COL.orange), mat(COL.orangeDark), mat(COL.orange), star, star];
  add(new THREE.BoxGeometry(.44, .4, .46), boxMats, [-.66, 1.0, 0]);
  add(new THREE.BoxGeometry(.3, .06, .3), mat(COL.metal), [-.62, .78, 0], [0, 0, 0], bike, 0);
  // Repartidor
  const rider = new THREE.Group(); bike.add(rider);
  add(new THREE.CapsuleGeometry(.075, .3, 6, 12), mat(COL.deep), [-.02, .74, .13], [0, 0, 1.25], rider);
  add(new THREE.CapsuleGeometry(.075, .3, 6, 12), mat(COL.deep), [-.02, .74, -.13], [0, 0, 1.25], rider);
  add(new THREE.CapsuleGeometry(.065, .26, 6, 12), mat(COL.deep), [.17, .5, .13], [0, 0, .2], rider);
  add(new THREE.CapsuleGeometry(.065, .26, 6, 12), mat(COL.deep), [.17, .5, -.13], [0, 0, .2], rider);
  const torso = add(new THREE.CapsuleGeometry(.17, .34, 8, 16), mat(COL.green), [-.16, 1.08, 0], [0, 0, -.32], rider); torso.scale.set(1, 1, 1.15);
  add(new THREE.BoxGeometry(.04, .44, .36), mat(COL.orange), [-.06, 1.1, 0], [0, 0, -.32], rider, 0);
  for (const z of [.2, -.2]) add(new THREE.CapsuleGeometry(.05, .36, 6, 12), mat(COL.green), [.22, 1.12, z], [0, 0, 1.2], rider);
  const head = new THREE.Group(); head.position.set(-.06, 1.5, 0); rider.add(head);
  add(new THREE.SphereGeometry(.17, 24, 16), mat(COL.orange), [0, 0, 0], [0, 0, 0], head);
  add(new THREE.BoxGeometry(.1, .1, .22), mat(COL.line), [.13, -.01, 0], [0, 0, 0], head, 0);
  add(new THREE.TorusGeometry(.17, .018, 8, 32, Math.PI), mat(COL.cream), [0, 0, 0], [Math.PI / 2, 0, 0], head, 0);

  bike.position.y = 0; root.scale.setScalar(1);
  let last = null;
  return {
    render(t, headingDeg = 90, elevationDeg = 30, speed = 1) {
      root.rotation.y = THREE.MathUtils.degToRad(90 - headingDeg);
      for (const s of wheels) s.rotation.z = -t * 16 * speed;
      bike.position.y = Math.sin(t * 22) * .012 * speed;
      bike.rotation.x = Math.sin(t * 9) * .02 * speed;
      head.rotation.z = Math.sin(t * 11) * .03 * speed;
      const e = THREE.MathUtils.degToRad(Math.max(18, Math.min(80, elevationDeg))), D = 6.2;
      camera.position.set(0, .7 + Math.sin(e) * D, Math.cos(e) * D); camera.lookAt(0, .62, 0);
      renderer.render(scene, camera); last = t;
    },
  };
}
