import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const CFG = Object.assign({ to: '', from: 'C', candles: 5, message: '' }, window.CAKE_CONFIG || {});
const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ---------------- renderer / scene ---------------- */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1033');
scene.fog = new THREE.Fog('#1a1033', 14, 34);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 3.6, 8.2);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.35, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 5.5;
controls.maxDistance = 15;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.45;
controls.rotateSpeed = 0.7;
controls.addEventListener('change', () => (lastInteract = performance.now()));

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.45, 1.25);
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight('#ffe9f5', '#3b2a6b', 1.0));
const sun = new THREE.DirectionalLight('#ffffff', 1.05);
sun.position.set(3, 6, 5);
scene.add(sun);

/* ---------------- materials ---------------- */
const grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;
const toon = (c, extra = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...extra });
const INK = new THREE.MeshBasicMaterial({ color: '#1d1030', side: THREE.BackSide });

function outline(mesh, th = 0.03) {
  const g = mesh.geometry;
  g.computeBoundingBox();
  const s = new THREE.Vector3();
  g.boundingBox.getSize(s);
  const o = new THREE.Mesh(g, INK);
  o.scale.set((s.x + 2 * th) / s.x, (s.y + 2 * th) / s.y, (s.z + 2 * th) / s.z);
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}

/* ---------------- world ---------------- */
// stars
{
  const n = 600, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(18, 28));
    v.y = Math.abs(v.y) * 0.9 - 2;
    p.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff6d8', size: 0.09, fog: false }));
  stars.name = 'stars';
  scene.add(stars);
}
// floor glow disc
{
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  const rg = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(255,140,200,0.55)');
  rg.addColorStop(0.5, 'rgba(160,110,255,0.18)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = rg;
  x.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.01;
  scene.add(m);
}

// plate
const plate = outline(new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.3, 0.18, 64), toon('#dfeaff')), 0.035);
plate.position.y = 0.09;
plate.userData.poke = true;
scene.add(plate);

// cake group: origin sits on plate top so squash is anchored at the bottom
const root = new THREE.Group();
root.position.y = 0.18;
scene.add(root);
const cake = new THREE.Group();
root.add(cake);

function tier(r, h, y0, color, glaze, dripColor) {
  const body = outline(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64), toon(color)), 0.035);
  body.position.y = y0 + h / 2;
  body.userData.poke = true;
  cake.add(body);
  const top = y0 + h;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.045, r + 0.045, 0.16, 64), toon(glaze));
  cap.position.y = top - 0.06;
  cap.userData.poke = true;
  cake.add(cap);
  const n = Math.round(r * 9);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.12, 0.12);
    const len = rand(0.05, h * 0.45);
    const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, len, 4, 10), toon(dripColor));
    d.position.set(Math.sin(a) * (r + 0.02), top - 0.1 - len / 2, Math.cos(a) * (r + 0.02));
    d.userData.poke = true;
    cake.add(d);
  }
  // piping balls at the base
  const m = Math.round(r * 13);
  const ballA = toon('#fffaf3'), ballB = toon(glaze);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), i % 2 ? ballA : ballB);
    b.position.set(Math.sin(a) * r, y0 + 0.07, Math.cos(a) * r);
    b.userData.poke = true;
    cake.add(b);
  }
  return top;
}
const T1 = { r: 1.7, h: 1.1 };
const top1 = tier(T1.r, T1.h, 0, '#ff9cc6', '#fff6ea', '#fff6ea');
const T2 = { r: 1.12, h: 0.85 };
const top2 = tier(T2.r, T2.h, top1, '#fff0d4', '#7a4632', '#7a4632');

// sprinkles
{
  const n = 170;
  const im = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.022, 0.07, 2, 6), toon('#ffffff'), n);
  const pal = ['#ff5c8a', '#ffd23f', '#3bceac', '#5e8bff', '#b388ff', '#ffffff'].map((c) => new THREE.Color(c));
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const onTop = i < 90;
    const a = rand(0, Math.PI * 2);
    const rr = onTop ? Math.sqrt(Math.random()) * (T2.r - 0.12) : rand(T2.r + 0.12, T1.r - 0.05);
    o.position.set(Math.sin(a) * rr, (onTop ? top2 : top1) + 0.025, Math.cos(a) * rr);
    o.rotation.set(Math.PI / 2, 0, rand(0, Math.PI * 2));
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
    im.setColorAt(i, pick(pal));
  }
  im.userData.poke = true;
  cake.add(im);
}

/* ---------------- face ---------------- */
const face = new THREE.Group();
cake.add(face);
const onSurface = (obj, x, y, out = 0.02) => {
  const z = Math.sqrt(T1.r * T1.r - x * x);
  obj.position.set(x, y, z + out);
  obj.rotation.y = Math.atan2(x, z);
  face.add(obj);
};
const eyes = [];
for (const s of [-1, 1]) {
  const g = new THREE.Group();
  const white = outline(new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), toon('#ffffff')), 0.03);
  white.scale.z = 0.62;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), new THREE.MeshBasicMaterial({ color: '#1d1030' }));
  pupil.scale.z = 0.5;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  shine.position.set(0.04, 0.045, 0.05);
  pupil.add(shine);
  g.add(white, pupil);
  white.userData.poke = true;
  onSurface(g, s * 0.43, 0.72, -0.02);
  eyes.push({ g, pupil, blink: 1 });
}
const blushMat = new THREE.MeshBasicMaterial({ color: '#ff4f8b', transparent: true, opacity: 0.55 });
for (const s of [-1, 1]) onSurface(new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), blushMat), s * 0.8, 0.52, 0.01);
const mouthMat = new THREE.MeshBasicMaterial({ color: '#1d1030' });
const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 32, Math.PI), mouthMat);
smile.rotation.z = Math.PI;
const smileWrap = new THREE.Group();
smileWrap.add(smile);
onSurface(smileWrap, 0, 0.52, 0.01);
const ooh = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 10, 24), mouthMat);
const oohWrap = new THREE.Group();
oohWrap.add(ooh);
onSurface(oohWrap, 0, 0.42, 0.01);
oohWrap.visible = false;

/* ---------------- candles ---------------- */
function stripeTex(c1, c2) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const x = cv.getContext('2d');
  x.fillStyle = c1; x.fillRect(0, 0, 64, 256);
  x.fillStyle = c2;
  for (let i = -8; i < 16; i++) {
    x.beginPath();
    x.moveTo(0, i * 32); x.lineTo(64, i * 32 - 40); x.lineTo(64, i * 32 - 24); x.lineTo(0, i * 32 + 16);
    x.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const candlePal = [['#ffffff', '#ff5c8a'], ['#ffffff', '#3bceac'], ['#ffffff', '#5e8bff'], ['#fff3b0', '#ff9f1c'], ['#ffffff', '#b388ff']];
const candles = [];
const N = Math.max(1, Math.min(12, CFG.candles | 0));
for (let i = 0; i < N; i++) {
  const a = ((i + 0.5) / N) * Math.PI * 2; // gap at the front so the pig shows
  const rr = 0.6; // centre stays free for the pig
  const h = 0.72;
  const g = new THREE.Group();
  g.position.set(Math.sin(a) * rr, top2, Math.cos(a) * rr);
  const [c1, c2] = candlePal[i % candlePal.length];
  const body = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, h, 16), toon('#ffffff', { map: stripeTex(c1, c2) })), 0.025);
  body.position.y = h / 2;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 6), new THREE.MeshBasicMaterial({ color: '#2a1a12' }));
  wick.position.y = h + 0.04;
  const flame = new THREE.Group();
  flame.position.y = h + 0.07;
  const outer = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.12).multiplyScalar(2.2) }));
  outer.scale.set(1, 2, 1);
  outer.position.y = 0.12;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.7).multiplyScalar(2.6) }));
  core.scale.set(1, 1.7, 1);
  core.position.y = 0.08;
  flame.add(outer, core);
  const light = new THREE.PointLight('#ffb35c', 0.8, 3, 2);
  light.position.y = h + 0.25;
  g.add(body, wick, flame, light);
  cake.add(g);
  const c = { g, flame, light, lit: true, hp: 0, k: 1, phase: rand(0, 10) };
  for (const m of [body, outer, core, wick]) m.userData.candle = c;
  candles.push(c);
}
function resetHP() { candles.forEach((c) => (c.hp = rand(0.5, 1.7))); }
resetHP();

/* ---------------- 小猪安琪 ---------------- */
// Built facing +z (same side as the cake's face), origin at her feet.
const PIG_S = 1.0;
const pig = (() => {
  const pink = toon('#ffb3c9'), deep = toon('#ff8fb2'), hoofM = toon('#d9668e');
  const black = new THREE.MeshBasicMaterial({ color: '#1d1030' });
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const tag = (m) => { m.userData.pig = true; return m; };
  const g = new THREE.Group();
  const bodyG = new THREE.Group(); // everything above the feet: sways / spins
  g.add(bodyG);

  for (const s of [-1, 1]) {
    const leg = tag(outline(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.2, 14), pink), 0.025));
    leg.position.set(s * 0.14, 0.1, 0.02);
    const hoof = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), hoofM));
    hoof.position.set(s * 0.14, 0.025, 0.02);
    g.add(leg, hoof);
  }
  const body = tag(outline(new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), pink), 0.03));
  body.scale.set(1, 0.92, 0.88);
  body.position.y = 0.42;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), toon('#ffd3e0'));
  belly.scale.set(1, 1, 0.4);
  belly.position.set(0, 0.38, 0.25);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 8, 16, Math.PI * 1.6), deep);
  tail.position.set(0, 0.45, -0.31);
  bodyG.add(body, belly, tail);

  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.28, 0.55, 0.03);
    const arm = tag(outline(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.15, 4, 10), pink), 0.025));
    arm.position.y = -0.12;
    const hoof = tag(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), hoofM));
    hoof.position.y = -0.24;
    pivot.add(arm, hoof);
    bodyG.add(pivot);
    arms.push({ pivot, s });
  }

  const head = new THREE.Group();
  head.position.y = 0.86;
  bodyG.add(head);
  const skull = tag(outline(new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 18), pink), 0.03));
  skull.scale.set(1.06, 0.95, 0.95);
  const snout = tag(outline(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.145, 0.1, 22), deep), 0.02));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.3);
  head.add(skull, snout);
  for (const s of [-1, 1]) {
    const nos = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), black);
    nos.scale.set(0.8, 1.2, 0.5);
    nos.position.set(s * 0.045, -0.05, 0.355);
    head.add(nos);
  }
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), black);
    e.scale.z = 0.6;
    e.position.set(s * 0.13, 0.07, 0.285);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), white);
    sh.position.set(0.014, 0.018, 0.03);
    e.add(sh);
    head.add(e);
    eyes.push(e);
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), blushMat);
    blush.scale.set(1, 0.6, 0.3);
    blush.position.set(s * 0.22, -0.05, 0.25);
    blush.rotation.y = s * 0.6;
    head.add(blush);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 16, Math.PI), black);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.15, 0.29);
  head.add(mouth);
  const ears = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.2, 0.22, 0.02);
    const ear = tag(outline(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 14), pink), 0.02));
    ear.position.y = 0.09;
    ear.rotation.x = 0.35;
    pivot.add(ear);
    head.add(pivot);
    ears.push({ pivot, s });
  }
  /* ---- outfits: one per dance style ---- */
  const gold = toon('#ffc93c'), mesh = (geo, mat) => new THREE.Mesh(geo, mat);
  // party: striped cone hat
  const hat = new THREE.Group();
  hat.position.set(-0.07, 0.3, 0);
  hat.rotation.z = 0.28;
  const cone = outline(mesh(new THREE.ConeGeometry(0.12, 0.3, 20), toon('#ffffff', { map: stripeTex('#ffd23f', '#5e8bff') })), 0.02);
  cone.position.y = 0.15;
  const pom = mesh(new THREE.SphereGeometry(0.05, 12, 8), toon('#ff5c8a'));
  pom.position.y = 0.31;
  hat.add(cone, pom);
  head.add(hat);

  // lashes (hula + ballet): two little flicks at the outer corner of each eye
  const lashes = new THREE.Group();
  for (const s of [-1, 1]) for (const k of [0, 1]) {
    const l = mesh(new THREE.CapsuleGeometry(0.009, 0.045, 2, 6), black);
    l.position.set(s * (0.175 + k * 0.01), 0.1 - k * 0.025, 0.265);
    l.rotation.z = -s * (1.0 + k * 0.45); // flick up-and-out from the outer corner
    lashes.add(l);
  }
  head.add(lashes);

  // hula: grass skirt, flower lei, hibiscus behind the ear
  const skirt = new THREE.Group();
  skirt.position.y = 0.34;
  const grass = ['#5fbf4a', '#7fd65a', '#4aa83c'].map((c) => toon(c));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const b = mesh(new THREE.ConeGeometry(0.045, 0.3, 5), grass[i % 3]);
    b.position.set(Math.sin(a) * 0.31, -0.12, Math.cos(a) * 0.28);
    b.rotation.set(Math.PI + Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25);
    skirt.add(b);
  }
  const band = mesh(new THREE.TorusGeometry(0.31, 0.03, 8, 32), toon('#ffd23f'));
  band.rotation.x = Math.PI / 2;
  band.scale.y = 0.9;
  skirt.add(band);
  bodyG.add(skirt);
  const lei = new THREE.Group();
  lei.position.y = 0.66;
  const flowerCols = ['#ff5c8a', '#ffd23f', '#ff9f1c', '#ffffff', '#b388ff'].map((c) => toon(c));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const f = mesh(new THREE.SphereGeometry(0.05, 10, 8), flowerCols[i % flowerCols.length]);
    f.position.set(Math.sin(a) * 0.25, -Math.max(0, Math.cos(a)) * 0.07, Math.cos(a) * 0.23);
    lei.add(f);
  }
  bodyG.add(lei);
  const hibiscus = new THREE.Group();
  hibiscus.position.set(-0.27, 0.13, 0.13);
  hibiscus.rotation.set(0, -0.7, 0.3);
  const petal = toon('#ff3d6e');
  for (let i = 0; i < 5; i++) {
    const p = mesh(new THREE.SphereGeometry(0.06, 10, 8), petal);
    const a = (i / 5) * Math.PI * 2;
    p.scale.set(1, 0.6, 0.35);
    p.position.set(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0);
    p.rotation.z = a;
    hibiscus.add(p);
  }
  const pistil = mesh(new THREE.SphereGeometry(0.03, 8, 6), toon('#ffd23f'));
  pistil.position.z = 0.02;
  hibiscus.add(pistil);
  head.add(hibiscus);

  // disco: sunglasses + gold chain
  const shades = new THREE.Group();
  shades.position.set(0, 0.075, 0.3);
  const lensM = new THREE.MeshBasicMaterial({ color: '#160a24' });
  for (const s of [-1, 1]) {
    const lens = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 20), lensM);
    lens.rotation.x = Math.PI / 2;
    lens.scale.set(1.25, 1, 0.85);
    lens.position.set(s * 0.125, 0, s * 0 - Math.abs(s) * 0.005);
    const glint = mesh(new THREE.CapsuleGeometry(0.008, 0.04, 2, 4), white);
    glint.position.set(s * 0.125 + 0.03, 0.02, 0.015);
    glint.rotation.z = -0.8;
    shades.add(lens, glint);
  }
  const bridge = mesh(new THREE.BoxGeometry(0.07, 0.018, 0.018), gold);
  bridge.position.set(0, 0.02, 0);
  shades.add(bridge);
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.015, 0.015, 0.24), gold);
    arm.position.set(s * 0.25, 0.01, -0.12);
    arm.rotation.y = s * 0.35;
    shades.add(arm);
  }
  head.add(shades);
  const chain = new THREE.Group();
  chain.position.y = 0.64;
  const links = mesh(new THREE.TorusGeometry(0.24, 0.022, 8, 40), gold);
  links.rotation.x = Math.PI / 2 - 0.35;
  const medal = outline(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 24), gold), 0.015);
  medal.rotation.x = Math.PI / 2;
  medal.position.set(0, -0.12, 0.27);
  chain.add(links, medal);
  bodyG.add(chain);

  // ballet: tiara + two-layer tutu
  const tiara = new THREE.Group();
  tiara.position.set(0, 0.27, 0.06);
  tiara.rotation.x = -0.25;
  const ring = mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 24, Math.PI), gold);
  ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI;
  tiara.add(ring);
  for (const [x, h] of [[-0.11, 0.07], [0, 0.11], [0.11, 0.07]]) {
    const spike = mesh(new THREE.ConeGeometry(0.025, h, 8), gold);
    spike.position.set(x, h / 2, Math.sqrt(0.17 * 0.17 - x * x));
    tiara.add(spike);
  }
  const gem = mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fd8ff').multiplyScalar(1.6) }));
  gem.position.set(0, 0.05, 0.175);
  tiara.add(gem);
  head.add(tiara);
  const tutu = new THREE.Group();
  tutu.position.y = 0.3;
  const t1 = outline(mesh(new THREE.CylinderGeometry(0.58, 0.44, 0.06, 32), toon('#ffd9ea')), 0.02);
  const t2 = mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.06, 32), toon('#fff3f8'));
  t2.position.y = 0.05;
  tutu.add(t1, t2);
  bodyG.add(tutu);

  const outfits = {
    party: [hat],
    hula: [skirt, lei, hibiscus, lashes],
    disco: [shades, chain],
    ballet: [tiara, tutu, lashes],
  };
  const all = [...new Set(Object.values(outfits).flat())];
  function dress(style) {
    all.forEach((o) => (o.visible = false));
    outfits[style].forEach((o) => (o.visible = true));
    mouth.material = style === 'hula' ? lipM : black;
    mouth.scale.setScalar(style === 'hula' ? 1.25 : 1);
  }
  const lipM = new THREE.MeshBasicMaterial({ color: '#e8285a' });

  g.position.set(0, top2, 0);
  g.scale.setScalar(PIG_S);
  g.visible = false;
  cake.add(g);
  return { g, bodyG, head, arms, ears, eyes, skirt, tutu, dress };
})();
// state: off → enter (falling) → on (dancing / idling) → leave
const P = { state: 'off', y: 0, vy: 0, sq: 0, sqv: 0, k: 0, spin: 0, amp: 0, blink: 1, blinkT: 1.5, style: '', kissed: false };
const STYLES = {
  party: { hello: '小猪安琪驾到！🐷', lines: ['哼哼！我是小猪安琪 🐷', '今天的蛋糕全是我的', '小猪安琪今天最可爱', '跳舞是小猪的天赋'] },
  hula: { hello: '阿罗哈～小猪安琪来扭了 🌺', lines: ['扭一扭，胖十斤也值得', '别看了，再看收费 💋', '这腰，是练过的', '小猪安琪，风情万种'] },
  disco: { hello: '墨镜一戴，谁也不爱 😎', lines: ['DJ，drop the beat！', '今晚的舞池属于小猪', '金链子是真的（假的）', '酷猪不需要解释 😎'] },
  ballet: { hello: '芭蕾公主安琪，请多指教 🩰', lines: ['踮脚尖很累的好吗', '优雅，永不过时', '天鹅湖？不，猪猪湖', '公主今天过生日 👑'] },
};
const STYLE_KEYS = Object.keys(STYLES);
function pickStyle() {
  P.style = P.style ? pick(STYLE_KEYS.filter((s) => s !== P.style)) : 'party';
  pig.dress(P.style);
}
/* ---------------- dances (one per outfit) ----------------
   Each returns a full-strength pose for beat position sb; the frame loop scales it by P.amp.
   Song is in 3/4 with a one-beat pickup: downbeats at 1, 4, 7…; long held notes at
   beats 4–6, 10–12, 17–19 and the final note from 23. arms = [[left up, left fwd], [right up, right fwd]]. */
const ss01 = (x) => THREE.MathUtils.smoothstep(x, 0, 1);
const win = (sb, a0, a1) => ss01((sb - a0) / (a1 - a0));
const bell = (sb, a0, a1) => Math.sin(Math.PI * THREE.MathUtils.clamp((sb - a0) / (a1 - a0), 0, 1));
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;
const beatInfo = (sb) => {
  const frac = ((sb % 1) + 1) % 1;
  const tada = sb > 23 && sb < SONG_BEATS + 0.5 ? 1 : 0;
  return {
    frac, tada,
    hop: 4 * frac * (1 - frac), // 0 on the beat, 1 between beats
    swing: Math.sin(Math.PI * sb),
    longs: bell(sb, 4, 6) + bell(sb, 10, 12) + bell(sb, 17, 19),
    inLong: (sb > 4 && sb < 6) || (sb > 10 && sb < 12) || (sb > 17 && sb < 19),
    finalHop: tada ? Math.max(0, Math.sin(Math.min(1, (sb - 23) / 1.2) * Math.PI)) * 0.35 : 0,
  };
};
const DANCES = {
  // bouncy birthday hop: bounce every beat, sway per bar, twirl on long notes, V-arms at the end
  party(sb) {
    const { hop, swing, tada, inLong, finalHop } = beatInfo(sb);
    const twirl = (win(sb, 4, 6) + win(sb, 10, 12) - win(sb, 17, 19)) * TAU;
    const n = 1 - tada;
    return {
      y: hop * 0.13 * n + finalHop, spin: twirl % TAU,
      bz: Math.sin((Math.PI * (sb - 1)) / 3) * 0.22 * n, by: swing * 0.25 * n,
      hx: -hop * 0.18, hz: -swing * 0.15, ear: hop * 0.35,
      arms: tada ? [[1.75, 0], [1.75, 0]] : [[1.2 - swing, 0], [1.2 + swing, 0]],
      eyes: inLong || tada ? [0.25, 0.25] : null,
    };
  },
  // 销魂 hula: figure-8 hips, head isolation against the hips, wavy arms, side-eye + winks, blown kiss
  hula(sb) {
    const { tada, longs } = beatInfo(sb);
    const th = (TAU * (sb - 1)) / 3; // one hip circle per bar
    const big = 1 + 0.8 * longs;
    const n = 1 - tada;
    const bar = (sb - 1) / 3, wink = ((bar % 2) + 2) % 2 > 1 && ((bar % 2) + 2) % 2 < 1.3;
    if (tada) {
      const fling = win(sb, 24.2, 24.8);
      return {
        bz: 0.14, by: -0.25, bx: 0.04, hz: -0.2, hy: 0.2, hx: 0.05, ear: 0.2, kiss: true,
        arms: [[0.15, 0.1], [lerp(1.0, 2.3, fling), lerp(-2.2, -0.4, fling)]],
        eyes: [1, 0.08], skirtZ: 0.1,
      };
    }
    return {
      y: -0.035 * (1 - Math.cos(2 * th)) / 2,
      bx: Math.sin(th) * 0.1 * big * n, bz: -Math.sin(th) * 0.15 * big, by: Math.sin(2 * th) * 0.32 * big,
      bxr: Math.cos(2 * th) * 0.06,
      hpx: -Math.sin(th) * 0.05 * big, hz: Math.sin(th) * 0.3, hy: 0.22 + Math.sin(th) * 0.15, hx: 0.08,
      ear: 0.1 + 0.1 * Math.sin(2 * th),
      arms: [[1.4 + Math.sin(th + 0.8) * 0.6 * big, -0.35 + Math.cos(th) * 0.2], [1.4 - Math.sin(th + 0.8) * 0.6 * big, -0.35 - Math.cos(th) * 0.2]],
      eyes: [1, wink ? 0.08 : 1],
      skirtY: -Math.sin(2 * th) * 0.2 * big, skirtZ: Math.sin(th - 0.7) * 0.22 * big,
    };
  },
  // disco: point to the sky / down across every two beats, hand on hip, hard head nods, spin on long notes
  disco(sb) {
    const { hop, tada, inLong, finalHop } = beatInfo(sb);
    const dir = THREE.MathUtils.clamp(Math.sin((Math.PI * sb) / 2) * 2.5, -1, 1);
    const u = (dir + 1) / 2;
    const spin = (win(sb, 4, 5.5) + win(sb, 10, 11.5) + win(sb, 17, 18.5)) * TAU;
    if (tada) return { y: finalHop, by: 0.4, bz: -0.08, hz: 0.18, hy: 0.25, arms: [[0.55, 0.3], [2.6, -0.2]], ear: 0.2 };
    return {
      y: hop * 0.06, spin: spin % TAU,
      bx: Math.sin(Math.PI * sb) * 0.06, bz: -Math.sin(Math.PI * sb) * 0.12, by: dir * 0.2,
      hx: -hop * 0.3, hy: dir * 0.3, hz: -dir * 0.1, ear: hop * 0.45,
      arms: inLong ? [[1.6, 0], [1.6, 0]] : [[0.55, 0.3], [lerp(-0.5, 2.5, u), lerp(-0.6, -0.2, u)]],
    };
  },
  // music-box ballerina: on tip-toe, slow continuous turn, arms breathe 2nd ↔ 5th position, curtsy at the end
  ballet(sb) {
    const { hop, tada } = beatInfo(sb);
    // quick pirouettes (whole turns) on bar downbeats, facing front in between
    const spin = [[4, 2], [7, 1], [10, 2], [13, 1], [17, 2], [20, 1]].reduce((acc, [b, n]) => acc + n * win(sb, b, b + 1.3), 0) * TAU;
    if (tada) {
      const b = bell(sb, 23, 26.3);
      return { y: -0.06 * b, bxr: 0.28 * b, hx: 0.25 * b, arms: [[0.9, -0.25], [0.9, -0.25]], eyes: [0.25, 0.25], tutu: 0.05 };
    }
    const m = (1 - Math.cos((TAU * (sb - 1)) / 6)) / 2;
    const lean = Math.sin((Math.PI * (sb - 1)) / 3) * 0.08;
    return {
      y: 0.07 + hop * 0.03, spin: spin % TAU,
      bz: lean, hz: -lean * 2.2, hx: -0.15,
      arms: [[lerp(1.5, 2.3, m), lerp(-0.1, -0.55, m)], [lerp(1.5, 2.3, m), lerp(-0.1, -0.55, m)]],
      tutu: hop * 0.06,
    };
  },
};
function showPig() {
  if (P.state === 'on' || P.state === 'enter') { P.sqv -= 6; return; }
  pickStyle(); // new outfit only when a pig (re)enters, i.e. after the candles were relit
  Object.assign(P, { state: 'enter', y: 3.4, vy: 0, k: 1, spin: 0, sq: 0, sqv: 0, kissed: false });
  pig.g.visible = true;
}
function hidePig() {
  if (P.state === 'off' || P.state === 'leave') return;
  P.state = 'leave';
  const wp = new THREE.Vector3(); pig.head.getWorldPosition(wp); puff(wp);
}

/* ---------------- balloons ---------------- */
const balloons = [];
const balloonCols = ['#ff5c8a', '#ffd23f', '#3bceac', '#5e8bff', '#b388ff', '#ff9f1c'];
for (let i = 0; i < 6; i++) {
  const a = [-1.75, -1.15, -0.55, 0.55, 1.15, 1.75][i] + rand(-0.15, 0.15);
  const g = new THREE.Group();
  const col = balloonCols[i];
  const ball = outline(new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), toon(col)), 0.03);
  ball.scale.set(1, 1.18, 1);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 10), toon(col));
  knot.position.y = -0.56;
  const pts = [];
  for (let k = 0; k <= 20; k++) pts.push(new THREE.Vector3(Math.sin(k * 0.6) * 0.06, -0.6 - k * 0.09, 0));
  const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#f5e9ff' }));
  g.add(ball, knot, str);
  const r = rand(4.4, 5.4);
  g.userData.base = new THREE.Vector3(Math.sin(a) * r, rand(2.0, 3.6) + (Math.abs(a) < 1 ? 0.6 : 0), -Math.cos(a) * r * 0.9 - 0.6);
  g.position.copy(g.userData.base);
  const b = { g, col, phase: rand(0, 6), popped: false, t: 0 };
  ball.userData.balloon = b;
  balloons.push(b);
  scene.add(g);
}

/* ---------------- particles ---------------- */
const CONF_N = 700;
const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.075, 0.13), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONF_N);
confetti.frustumCulled = false;
const cp = [];
const confPal = ['#ff5c8a', '#ffd23f', '#3bceac', '#5e8bff', '#b388ff', '#ff9f1c', '#ffffff'].map((c) => new THREE.Color(c).multiplyScalar(1.15));
const dummy = new THREE.Object3D();
for (let i = 0; i < CONF_N; i++) {
  cp.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 });
  confetti.setColorAt(i, pick(confPal));
  dummy.scale.setScalar(0); dummy.updateMatrix(); confetti.setMatrixAt(i, dummy.matrix);
}
scene.add(confetti);
let confIdx = 0;
function burst(origin, n = 120, power = 6, up = 1) {
  for (let i = 0; i < n; i++) {
    const q = cp[confIdx]; confIdx = (confIdx + 1) % CONF_N;
    q.p.copy(origin);
    q.v.randomDirection().multiplyScalar(rand(0.3, 1) * power);
    q.v.y = Math.abs(q.v.y) * up + power * 0.35;
    q.r.set(rand(0, 6), rand(0, 6), rand(0, 6));
    q.w.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
    q.life = rand(3, 5);
  }
}
const smokes = [];
for (let i = 0; i < 40; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: '#d9d2e9', transparent: true, opacity: 0, depthWrite: false }));
  m.visible = false;
  scene.add(m);
  smokes.push({ m, life: 0, v: new THREE.Vector3() });
}
let smokeIdx = 0;
function puff(pos) {
  for (let i = 0; i < 6; i++) {
    const s = smokes[smokeIdx]; smokeIdx = (smokeIdx + 1) % smokes.length;
    s.m.position.copy(pos).add(new THREE.Vector3(rand(-0.04, 0.04), i * 0.05, rand(-0.04, 0.04)));
    s.v.set(rand(-0.15, 0.15), rand(0.5, 0.9), rand(-0.15, 0.15));
    s.life = 1 + i * 0.12;
    s.m.visible = true;
  }
}

/* ---------------- audio ---------------- */
let actx = null, master = null, muted = false, windGain = null;
function ensureAudio() {
  try {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(actx.destination);
      const len = actx.sampleRate * 2, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
      windGain = actx.createGain(); windGain.gain.value = 0;
      src.connect(f).connect(windGain).connect(master); src.start();
    }
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { actx = null; }
}
function tone(freq, t0, dur, type = 'triangle', vol = 0.25, slideTo = 0) {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
const pop = (hi = 1) => actx && tone(520 * hi, actx.currentTime, 0.14, 'sine', 0.4, 110 * hi);
const boing = () => actx && tone(180, actx.currentTime, 0.25, 'sine', 0.3, 420);
const oink = () => {
  if (!actx) return;
  const t = actx.currentTime;
  tone(260, t, 0.11, 'sawtooth', 0.12, 170);
  tone(240, t + 0.14, 0.13, 'sawtooth', 0.12, 150);
};
// Song clock shared by the audio and the pig's dance (audio time when we have it).
const BEAT = 0.36, SONG_BEATS = 26;
const song = { start: -1e9, audio: false };
// use the audio clock only if it is actually ticking (a suspended context's time is frozen)
const songNow = () => (song.audio ? actx.currentTime : performance.now() / 1000);
const songPlaying = () => (songNow() - song.start) / BEAT < SONG_BEATS + 0.5;
function melody() {
  song.audio = !!actx && actx.state === 'running';
  song.start = songNow() + 0.15;
  if (!actx) return;
  const n = { G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784 };
  const notes = [['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
    ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
    ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
    ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3]];
  let t = song.start;
  for (const [k, b] of notes) {
    tone(n[k], t, b * BEAT * 0.95, 'square', 0.07);
    tone(n[k] * 2, t, b * BEAT * 0.6, 'triangle', 0.08);
    t += b * BEAT;
  }
}

/* ---------------- state ---------------- */
let wind = 0, holding = false, celebrated = false, pokes = 0, disco = 0;
const wob = { a: 0, v: 0 };
const jump = { y: 0, v: 0 };
let faceMood = 'smile', moodTimer = 0, lastInteract = 0, blinkT = 2;
const pointer = new THREE.Vector2(0, 0);
const ray = new THREE.Raycaster();

const bubble = $('#bubble');
let bubbleT = 0;
const lines = ['别戳了，我是蛋糕不是按钮', '我是跨时区空运来的', '今天的热量不算数', '再戳我就自己把蜡烛吃了', '今天你最大，随便戳', '奶油是真心打发的', '轻点！我是易碎品', '生日快乐！（被迫营业版）', '戳满 7 下有惊喜……', '我已经尽力长得好看了'];
function say(t) {
  bubble.textContent = t;
  bubble.classList.remove('show'); void bubble.offsetWidth; bubble.classList.add('show');
  bubbleT = 2.4;
}
function setMood(m, t = 1.2) { faceMood = m; moodTimer = t; }

function blowOut(c) {
  if (!c.lit) return;
  c.lit = false;
  const wp = new THREE.Vector3(); c.flame.getWorldPosition(wp);
  puff(wp.add(new THREE.Vector3(0, 0.15, 0)));
  pop(1 + Math.random() * 0.4);
  setMood('ooh', 0.6);
  if (candles.every((k) => !k.lit)) setTimeout(celebrate, 450);
}
function relight() {
  candles.forEach((c, i) => setTimeout(() => { c.lit = true; c.k = 0; boing(); }, i * 140));
  resetHP();
  endParty();
}
function endParty() {
  $('#blow').classList.remove('hide');
  $('#hint').classList.remove('hide');
  $('#party').classList.remove('show');
  partyView = false; returning = true;
  controls.enableZoom = true;
  setMood('smile');
  hidePig();
}
function celebrate() {
  ensureAudio();
  celebrated = true;
  jump.v = 7; wob.v -= 3;
  setMood('happy', 6);
  const o = new THREE.Vector3(0, 2.6, 0);
  burst(o, 260, 7);
  setTimeout(() => burst(new THREE.Vector3(-2, 1, 0.5), 120, 6), 300);
  setTimeout(() => burst(new THREE.Vector3(2, 1, 0.5), 120, 6), 520);
  setTimeout(() => burst(new THREE.Vector3(0, 3.2, -1), 180, 7.5), 800);
  melody();
  showPig();
  $('#blow').classList.add('hide');
  $('#hint').classList.add('hide');
  const party = $('#party');
  party.classList.add('show');
  partyView = true;
  controls.enableZoom = false;
  typeMsg();
}
let typing = 0;
function typeMsg() {
  const el = $('#msg'); const txt = CFG.message || '';
  const id = ++typing; el.textContent = '';
  if (!txt) { $('#card').classList.add('empty'); return; }
  let i = 0;
  const step = () => { if (id !== typing) return; el.textContent = txt.slice(0, ++i); if (i < txt.length) setTimeout(step, txt[i - 1] === '\n' ? 260 : 55); };
  setTimeout(step, 900);
}
function startDisco() {
  disco = 9; say('进入派对模式 🪩'); melody(); burst(new THREE.Vector3(0, 2.8, 0), 150, 6);
}

/* ---------------- input ---------------- */
let down = null;
canvas.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
canvas.addEventListener('pointerdown', (e) => {
  ensureAudio();
  down = { x: e.clientX, y: e.clientY };
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  lastInteract = performance.now();
});
canvas.addEventListener('pointerup', (e) => {
  lastInteract = performance.now();
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(scene.children, true);
  for (const h of hits) {
    const u = h.object.userData;
    if (u.pig && P.state === 'on') {
      oink();
      if (songPlaying()) { P.sqv -= 8; say(pick(STYLES[P.style].lines)); }
      else { P.sqv -= 8; say(pick(STYLES[P.style].lines)); melody(); } // same pig dances again
      return;
    }
    if (u.candle) {
      if (u.candle.lit) blowOut(u.candle);
      else {
        u.candle.lit = true; u.candle.k = 0; u.candle.hp = rand(0.5, 1.5); boing();
        if (P.state === 'on' || P.state === 'enter') endParty(); else say('诶？我又着了');
      }
      return;
    }
    if (u.balloon && !u.balloon.popped) {
      const b = u.balloon; b.popped = true; b.t = 3.5; b.g.visible = false;
      burst(b.g.position.clone(), 70, 4); pop(1.6);
      return;
    }
    if (u.poke) {
      wob.v -= 9; setMood('ooh', 0.5); pokes++;
      if (pokes % 7 === 0) startDisco(); else say(pick(lines));
      return;
    }
  }
});
const blowBtn = $('#blow');
const startBlow = (e) => { e.preventDefault(); ensureAudio(); holding = true; blowBtn.classList.add('on'); };
const endBlow = () => { holding = false; blowBtn.classList.remove('on'); };
blowBtn.addEventListener('pointerdown', startBlow);
addEventListener('pointerup', endBlow);
blowBtn.addEventListener('pointerleave', endBlow);
blowBtn.addEventListener('pointercancel', endBlow);
addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) { ensureAudio(); holding = true; blowBtn.classList.add('on'); } });
addEventListener('keyup', (e) => { if (e.code === 'Space') endBlow(); });
addEventListener('contextmenu', (e) => e.preventDefault());
$('#again').addEventListener('click', () => { ensureAudio(); relight(); });
// 奶龙 ↔ 小猪安琪: tap the signature, 奶龙 says a line on the card and the pig answers in her bubble
const chat = [
  ['小猪安琪，生日快乐！🐲', '哼哼！谢谢奶龙～ 🐷'],
  ['蛋糕分我一口嘛', '不给！今天我最大'],
  ['那我给你唱首歌', '……你跑调了，但我原谅你', 'sing'],
  ['我是奶龙，我才是最可爱的', '？？？今天是谁生日'],
  ['好好好，你最可爱', '这还差不多 💕'],
  ['奶龙祝你天天开心，永远不长胖', '后半句做不到，但谢谢'],
  ['明年还给你做蛋糕', '拉钩！说话算话 🤙'],
];
let chatI = 0, chatT = 0;
$('#sig').addEventListener('click', () => {
  ensureAudio();
  const [mine, hers, act] = chat[chatI];
  chatI = (chatI + 1) % chat.length;
  const sig = $('#sig');
  sig.textContent = '奶龙：' + mine;
  sig.classList.remove('talk'); void sig.offsetWidth; sig.classList.add('talk');
  if (act === 'sing' && !songPlaying()) melody();
  clearTimeout(chatT);
  chatT = setTimeout(() => {
    if (P.state === 'on') { oink(); P.sqv -= 6; }
    say(hers);
  }, act === 'sing' ? 2600 : 700);
});
$('#mute').addEventListener('click', () => {
  ensureAudio(); muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.55;
  $('#mute').textContent = muted ? '🔇' : '🔊';
});

/* ---------------- resize ---------------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 44 : 38;
  camera.updateProjectionMatrix();
  const hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const need = Math.max(8.9, 3.3 / Math.tan(hf));
  controls.target.y = w / h < 0.8 ? 1.75 : 1.35;
  camera.position.sub(controls.target).setLength(need).add(controls.target);
  controls.maxDistance = need * 1.6;
  normalDist = need;
}

/* Party framing: while the title + card are up, steer camera distance and a vertical
   view offset so plate→pig hat sits in the free band between them. */
let partyView = false, returning = false, normalDist = 9, viewOffY = 0;
const fp = new THREE.Vector3();
const toPx = (x, y, z) => {
  fp.set(x, y, z).project(camera);
  return [(fp.x * 0.5 + 0.5) * innerWidth, (-fp.y * 0.5 + 0.5) * innerHeight];
};
function frameParty(dt) {
  if (!partyView && !returning) return;
  const W = innerWidth, H = innerHeight;
  const d = camera.position.distanceTo(controls.target);
  let goalD = normalDist, goalOff = 0;
  if (partyView) {
    camera.updateMatrixWorld();
    const fx = camera.position.x - controls.target.x, fz = camera.position.z - controls.target.z;
    const fl = Math.hypot(fx, fz) || 1, cx = fx / fl, cz = fz / fl;
    const R = 2.55;
    const [, yTop] = toPx(0, 3.85, 0);
    const [, yBot] = toPx(cx * R, 0, cz * R);
    const [xL] = toPx(-cz * R, 0.18, cx * R);
    const [xR] = toPx(cz * R, 0.18, -cx * R);
    const bandTop = $('#to').getBoundingClientRect().bottom + 8 + 84; // room for the speech bubble above the pig
    const bandBot = H - 74 - $('#card').offsetHeight - 10;
    const f = Math.min((bandBot - bandTop) / (yBot - yTop), (W * 0.96) / Math.abs(xR - xL));
    goalD = THREE.MathUtils.clamp(d / f, 4, 30);
    goalOff = viewOffY - ((bandTop + bandBot) / 2 - (yTop + yBot) / 2);
  }
  const k = Math.min(1, dt * 3);
  const nd = d + (goalD - d) * k;
  controls.minDistance = Math.min(5.5, nd); controls.maxDistance = Math.max(normalDist * 1.6, nd);
  camera.position.sub(controls.target).setLength(nd).add(controls.target);
  viewOffY += (goalOff - viewOffY) * k;
  if (!partyView && Math.abs(viewOffY) < 0.5 && Math.abs(nd - normalDist) < 0.02) {
    viewOffY = 0; returning = false; camera.clearViewOffset();
    controls.minDistance = 5.5; controls.maxDistance = normalDist * 1.6;
  }
  else camera.setViewOffset(W, H, 0, viewOffY, W, H);
}
addEventListener('resize', resize);
resize();

/* ---------------- loop ---------------- */
const clock = new THREE.Clock();
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const discoLights = ['#ff3d8b', '#3dd6ff', '#ffe23d'].map((c) => { const l = new THREE.PointLight(c, 0, 9, 1.2); scene.add(l); return l; });
const bgA = new THREE.Color('#1a1033'), bgTmp = new THREE.Color();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  controls.update();
  frameParty(dt);

  // wind
  wind += ((holding ? 1 : 0) - wind) * Math.min(1, dt * (holding ? 5 : 3));
  if (windGain) windGain.gain.value = wind * 0.35;
  tmp.copy(root.position).sub(camera.position); tmp.y = 0; tmp.normalize();
  const axis = new THREE.Vector3(tmp.z, 0, -tmp.x).applyQuaternion(cake.quaternion.clone().invert());
  let anyLit = false;
  for (const c of candles) {
    c.k += ((c.lit ? 1 : 0) - c.k) * Math.min(1, dt * (c.lit ? 6 : 18));
    const fl = 1 + Math.sin(t * 18 + c.phase) * 0.08 + Math.sin(t * 31 + c.phase * 2) * 0.05;
    c.flame.scale.set(c.k * (1 + wind * 0.3), c.k * fl * (1 - wind * 0.35), c.k);
    c.flame.quaternion.setFromAxisAngle(axis, wind * (0.9 + Math.sin(t * 25 + c.phase) * 0.25) + Math.sin(t * 3 + c.phase) * 0.06);
    c.light.intensity = c.k * (0.8 + Math.sin(t * 20 + c.phase) * 0.15);
    c.flame.visible = c.k > 0.02;
    if (c.lit) {
      anyLit = true;
      if (wind > 0.5) { c.hp -= dt * wind; if (c.hp <= 0) blowOut(c); }
    }
  }
  if (holding && anyLit) setMood('blow', 0.2);

  // cake squash & jump & look-at-you hop
  wob.v += (-220 * wob.a - 9 * wob.v) * dt; wob.a += wob.v * dt;
  wob.a = THREE.MathUtils.clamp(wob.a, -0.35, 0.35);
  const wasAir = jump.y > 0;
  jump.v -= 28 * dt; jump.y += jump.v * dt;
  if (jump.y <= 0) { jump.y = 0; if (wasAir) wob.v -= Math.min(10, Math.abs(jump.v) * 0.9); jump.v = 0; }
  const camAz = Math.atan2(camera.position.x, camera.position.z);
  let diff = camAz - cake.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  if (disco > 0) {
    disco -= dt;
    cake.rotation.y += dt * 4;
    if (jump.y === 0) jump.v = 5;
    discoLights.forEach((l, i) => { const a = t * 2.5 + i * 2.1; l.position.set(Math.sin(a) * 3, 3.5, Math.cos(a) * 3); l.intensity = 30; });
    bgTmp.setHSL((t * 0.15) % 1, 0.45, 0.12); scene.background.copy(bgTmp); scene.fog.color.copy(bgTmp);
  } else {
    discoLights.forEach((l) => (l.intensity *= 0.9));
    scene.background.lerp(bgA, dt * 2); scene.fog.color.copy(scene.background);
    if (performance.now() - lastInteract > 900 && Math.abs(diff) > 0.35 && jump.y === 0 && wob.a > -0.05) {
      jump.v = 4.2; boing();
    }
    if (jump.y > 0) cake.rotation.y += diff * Math.min(1, dt * 7);
  }
  const sq = wob.a + Math.sin(t * 2) * 0.012;
  root.scale.set(1 - sq * 0.55, 1 + sq, 1 - sq * 0.55);
  root.position.y = 0.18 + jump.y;

  // face
  moodTimer -= dt;
  if (moodTimer <= 0) faceMood = 'smile';
  blinkT -= dt;
  if (blinkT <= 0) { blinkT = rand(1.8, 4.5); eyes.forEach((e) => (e.blink = 0)); }
  ray.setFromCamera(pointer, camera);
  ray.ray.at(6, tmp2);
  const squint = faceMood === 'happy' ? 0.35 : faceMood === 'blow' ? 0.6 : 1;
  for (const e of eyes) {
    e.blink += (1 - e.blink) * Math.min(1, dt * 9);
    const s = Math.min(e.blink, 1) * squint;
    e.g.scale.set(faceMood === 'ooh' ? 1.15 : 1, Math.max(0.08, s) * (faceMood === 'ooh' ? 1.15 : 1), 1);
    const loc = e.g.worldToLocal(tmp2.clone()).normalize();
    e.pupil.position.lerp(new THREE.Vector3(loc.x * 0.11, loc.y * 0.11, 0.115), Math.min(1, dt * 12));
  }
  const o = faceMood === 'ooh' || faceMood === 'blow';
  oohWrap.visible = o; smileWrap.visible = !o;
  smileWrap.scale.setScalar(faceMood === 'happy' ? 1.6 : 1);
  oohWrap.scale.set(faceMood === 'blow' ? 0.7 : 1.1, faceMood === 'blow' ? 0.7 : 1.3, 1);
  face.position.z = faceMood === 'blow' ? Math.sin(t * 30) * 0.01 : 0;

  // pig: fall in, land, dance to the song clock
  if (P.state !== 'off') {
    if (P.state === 'enter') {
      P.vy -= 20 * dt; P.y += P.vy * dt; P.spin += dt * 9;
      if (P.y <= 0) {
        P.y = 0; P.vy = 0; P.state = 'on'; P.sqv -= 10;
        P.spin = Math.atan2(Math.sin(P.spin), Math.cos(P.spin));
        boing(); setTimeout(oink, 120);
        const wp = new THREE.Vector3(); pig.g.getWorldPosition(wp); burst(wp.add(new THREE.Vector3(0, 0.3, 0)), 50, 3.5);
        say(STYLES[P.style].hello);
      }
    } else P.spin *= Math.max(0, 1 - dt * 6);
    if (P.state === 'leave') {
      P.k -= dt * 4;
      if (P.k <= 0) { P.k = 0; P.state = 'off'; pig.g.visible = false; }
    }
    P.sqv += (-260 * P.sq - 10 * P.sqv) * dt; P.sq += P.sqv * dt;
    P.sq = THREE.MathUtils.clamp(P.sq, -0.4, 0.4);

    const sb = (songNow() - song.start) / BEAT; // beats since the song started
    const playing = P.state === 'on' && sb > -0.2 && sb < SONG_BEATS + 0.5;
    P.amp += ((playing ? 1 : 0) - P.amp) * Math.min(1, dt * 5);
    const a = P.amp;
    const pose = DANCES[P.style](sb, t);
    if (P.style === 'hula' && pose.kiss && playing && !P.kissed) { P.kissed = true; say('mua~ 💋'); }
    if (!playing && sb > SONG_BEATS) P.kissed = false;

    pig.g.position.y = top2 + P.y + (pose.y || 0) * a;
    pig.g.rotation.y = P.spin + (pose.spin || 0) * a;
    const s = PIG_S * P.k;
    pig.g.scale.set(s * (1 - P.sq * 0.5), s * (1 + P.sq), s * (1 - P.sq * 0.5));
    pig.bodyG.position.x = (pose.bx || 0) * a;
    pig.bodyG.rotation.set((pose.bxr || 0) * a, (pose.by || 0) * a, (pose.bz || 0) * a + Math.sin(t * 1.6) * 0.03);
    pig.head.position.x = (pose.hpx || 0) * a;
    pig.head.rotation.set((pose.hx || 0) * a + Math.sin(t * 2.2) * 0.03, (pose.hy || 0) * a, (pose.hz || 0) * a);
    pig.arms.forEach(({ pivot, s: side }, i) => {
      const [up, fwd] = pose.arms[i];
      pivot.rotation.z = side * (0.3 + a * up);
      pivot.rotation.x = a * fwd;
    });
    for (const { pivot, s: side } of pig.ears) {
      pivot.rotation.z = -side * (0.45 + (pose.ear || 0) * a + Math.sin(t * 5 + side) * 0.04);
    }
    pig.skirt.rotation.set(0, (pose.skirtY || 0) * a, (pose.skirtZ || 0) * a);
    pig.tutu.scale.set(1 + (pose.tutu || 0) * a, 1, 1 + (pose.tutu || 0) * a);
    P.blinkT -= dt;
    if (P.blinkT <= 0) { P.blinkT = rand(1.5, 4); P.blink = 0; }
    P.blink += (1 - P.blink) * Math.min(1, dt * 9);
    pig.eyes.forEach((e, i) => {
      const want = pose.eyes && a > 0.5 ? pose.eyes[i] : 1;
      e.scale.y = Math.max(0.08, Math.min(want, P.blink));
    });
    if (P.style === 'disco' && a > 0.5 && disco <= 0) {
      discoLights.forEach((l, i) => { const an = t * 3 + i * 2.1; l.position.set(Math.sin(an) * 3, 3.5, Math.cos(an) * 3); l.intensity = 3.5 * a; });
    }
  }

  // balloons
  for (const b of balloons) {
    if (b.popped) {
      b.t -= dt;
      if (b.t <= 0) { b.popped = false; b.g.visible = true; b.g.scale.setScalar(0.01); }
      continue;
    }
    const base = b.g.userData.base;
    b.g.position.set(base.x + Math.sin(t * 0.7 + b.phase) * 0.15, base.y + Math.sin(t * 1.1 + b.phase) * 0.25, base.z);
    b.g.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.12;
    b.g.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 6));
  }

  // confetti
  for (let i = 0; i < CONF_N; i++) {
    const q = cp[i];
    if (q.life <= 0) continue;
    q.life -= dt;
    q.v.y -= 7 * dt; q.v.multiplyScalar(1 - 1.6 * dt);
    q.v.x += Math.sin(t * 4 + i) * dt * 1.5;
    q.p.addScaledVector(q.v, dt);
    if (q.p.y < 0.02) { q.p.y = 0.02; q.v.set(0, 0, 0); q.w.multiplyScalar(0.8); }
    q.r.x += q.w.x * dt; q.r.y += q.w.y * dt; q.r.z += q.w.z * dt;
    dummy.position.copy(q.p); dummy.rotation.copy(q.r);
    dummy.scale.setScalar(q.life <= 0 ? 0 : Math.min(1, q.life * 2));
    dummy.updateMatrix(); confetti.setMatrixAt(i, dummy.matrix);
  }
  confetti.instanceMatrix.needsUpdate = true;
  // smoke
  for (const s of smokes) {
    if (s.life <= 0) continue;
    s.life -= dt;
    s.m.position.addScaledVector(s.v, dt);
    s.m.scale.setScalar(0.6 + (1.6 - s.life) * 1.3);
    s.m.material.opacity = Math.max(0, Math.min(0.5, s.life * 0.45));
    if (s.life <= 0) s.m.visible = false;
  }
  scene.getObjectByName('stars').rotation.y = t * 0.01;

  // speech bubble follows the cake
  if (bubbleT > 0) {
    bubbleT -= dt;
    const top = P.state === 'off' ? 3.05 : top2 + 1.75 * P.k + P.y;
    tmp.set(0, root.position.y + top * root.scale.y, 0).project(camera);
    bubble.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
    if (bubbleT <= 0) bubble.classList.remove('show');
  }

  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__cake = { celebrate, relight, candles, say, P, song, dress: (s) => { P.style = s; pig.dress(s); } };
