import * as THREE from 'three';
import { BUILD, SPACE, std, box, cyl, wall, pixelTexture } from './kit.js';
import { ROOM, DOORWAY, CORRIDOR } from './livingroom.js';
import { DOGROOM } from './dogroom.js';
import { KITCHEN } from './kitchen.js';
import { DOG_FACE, DOG_SIDE, CAT_LOAF } from './pixelart.js';

// 讓屋子有生活感的小東西：
//   buildDecor(world)：踢腳板、走廊的照片牆、客廳的時鐘（要在 relayout() 之前加進屋子，才會跟著牆走）
//   initLife(scene)：從落地門照進來的陽光與飄著的灰塵（relayout() 之後），
//                    回傳 update(dt, time)：立扇轉動與擺頭、時鐘走動、灰塵飄動
const HW = ROOM.W / 2, HD = ROOM.D / 2;

/* ---------- 踢腳板 ---------- */

// 沿著牆腳的一條木條（和牆一樣是單面，俯瞰時從外面看不到）。gaps：門洞 [起, 迄]
function skirting(g, mat, axis, fixed, a, b, rotY, gaps = []) {
  const H = 0.09;
  let cur = a;
  for (const [s, e] of [...gaps, [b, b]].sort((p, q) => p[0] - q[0])) {
    if (s - cur > 0.01) {
      const mid = (cur + s) / 2;
      const m = axis === 'x' ? wall(g, mat, mid, H / 2, fixed, s - cur, H, rotY) : wall(g, mat, fixed, H / 2, mid, s - cur, H, rotY);
      m.castShadow = false;
    }
    cur = e;
  }
}

function buildSkirting(g) {
  const mat = std(0x9a6a42, { roughness: 0.6 });
  const o = 0.004;                                       // 離牆面一點點，才不會和牆打架
  const { x1, x2, len } = CORRIDOR, zEnd = -HD - len;
  // 客廳：西牆、東牆、北牆（留走廊門洞）、南牆西側那一小段
  skirting(g, mat, 'z', -HW + o, -HD, HD, Math.PI / 2);
  skirting(g, mat, 'z', HW - o, -HD, HD, -Math.PI / 2);
  skirting(g, mat, 'x', -HD + o, -HW, HW, 0, [[DOORWAY.x1, DOORWAY.x2]]);
  skirting(g, mat, 'x', HD - o, -HW, -1.8, Math.PI);
  // 走廊：西牆（留狗房門洞）、東牆、盡頭（留廚房門洞）
  skirting(g, mat, 'z', x1 + o, zEnd, -HD, Math.PI / 2, [[DOGROOM.door.z1, DOGROOM.door.z2]]);
  skirting(g, mat, 'z', x2 - o, zEnd, -HD, -Math.PI / 2);
  skirting(g, mat, 'x', zEnd + o, x1, x2, 0, [[KITCHEN.door.x1, KITCHEN.door.x2]]);
}

/* ---------- 走廊的照片牆：巴福柔和貓咪的像素畫像 ---------- */

// 點陣圖放大成整數倍、四周留米色襯紙
function framedArt(art, scale, padX, padY) {
  const c = document.createElement('canvas');
  c.width = art.width * scale + padX * 2;
  c.height = art.height * scale + padY * 2;
  const g = c.getContext('2d');
  g.fillStyle = '#efe4cf';
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(art, padX, padY, art.width * scale, art.height * scale);
  return c;
}

function buildPhotoWall(g) {
  const frame = std(0x4a2f20, { roughness: 0.5 });
  const x = CORRIDOR.x2 - 0.015;
  // [畫, 寬（公尺）, 高度, z]
  const photos = [
    [framedArt(DOG_FACE, 4, 8, 8), 0.34, 1.62, -2.75],
    [framedArt(DOG_SIDE, 3, 9, 9), 0.48, 1.45, -3.45],
    [framedArt(CAT_LOAF, 3, 10, 14), 0.42, 1.68, -4.1],
  ];
  for (const [canvas, w, y, z] of photos) {
    const h = w * canvas.height / canvas.width;
    const p = new THREE.Group();
    p.position.set(x, y, z);
    p.rotation.y = -Math.PI / 2;                       // 掛在東牆、面向西
    box(p, w + 0.05, h + 0.05, 0.02, frame, 0, 0, 0);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0xffffff, { map: pixelTexture(canvas), roughness: 0.9 }));
    pic.position.z = 0.011;
    p.add(pic);
    g.add(p);
  }
}

/* ---------- 客廳東牆的時鐘：顯示真的現在時間 ---------- */

function buildClock(g) {
  const clock = new THREE.Group();
  clock.name = 'clock';
  clock.position.set(HW - 0.03, 2.08, -0.75);
  clock.rotation.y = -Math.PI / 2;                     // 掛在東牆、面向西
  const R = 0.16;
  cyl(clock, R + 0.02, R + 0.02, 0.04, std(0x6b4a30, { roughness: 0.5 }), 0, 0, 0, 24).rotation.x = Math.PI / 2;
  cyl(clock, R, R, 0.01, std(0xf6f1e4, { roughness: 0.7 }), 0, 0, 0.021, 24).rotation.x = Math.PI / 2;
  const ink = std(0x2a2420);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    box(clock, i % 3 ? 0.012 : 0.02, i % 3 ? 0.025 : 0.04, 0.005, ink, Math.sin(a) * R * 0.82, Math.cos(a) * R * 0.82, 0.028).rotation.z = -a;
  }
  const hand = (len, w, mat, z) => {
    const pivot = new THREE.Group();
    pivot.position.z = z;
    box(pivot, w, len, 0.004, mat, 0, len / 2 - 0.02, 0);
    clock.add(pivot);
    return pivot;
  };
  clock.userData.hands = [hand(0.09, 0.016, ink, 0.03), hand(0.13, 0.01, ink, 0.034), hand(0.14, 0.004, std(0xc0392b), 0.038)];
  cyl(clock, 0.012, 0.012, 0.01, ink, 0, 0, 0.04, 10).rotation.x = Math.PI / 2;
  g.add(clock);
}

export function buildDecor(world) {
  BUILD.structural = true;            // 踢腳板是房間結構，跟著牆一起放大
  buildSkirting(world);
  BUILD.structural = false;
  buildPhotoWall(world);
  buildClock(world);
}

/* ---------- 陽光與灰塵 ---------- */

// 陽光從南邊、偏東一點斜斜照進來：玻璃上高度 y 的一點，落在地上往北移 y * SUN_Z、往西移 y * -SUN_X
// （往西偏，光斑才不會超出東牆）
const SUN_Z = 0.62, SUN_X = -0.22;
const GLASS = [0.42, 2.08];          // 落地門玻璃的下緣、上緣高度

// 光斑的貼圖：中間亮、邊緣柔和淡出
function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 32, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.15, 'rgba(255,255,255,1)');
  grad.addColorStop(0.85, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 32);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.2, 'rgba(0,0,0,1)');
  v.addColorStop(0.8, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function initLife(scene) {
  /* ----- 地上的光斑：四片落地門各一塊平行四邊形 ----- */
  const fx1 = -1.8, pw = (HW - fx1) / 4, wGlass = pw - 0.14;       // 和 livingroom.js 的落地門一致（配置座標）
  const zWall = HD * SPACE;
  const lightMat = new THREE.MeshBasicMaterial({
    map: softTexture(), color: 0xffd08a, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const panes = [];
  for (let i = 0; i < 4; i++) {
    const xa = (fx1 + pw * (i + 0.5) - wGlass / 2) * SPACE, xb = xa + wGlass * SPACE;
    panes.push([xa, xb]);
    const [y1, y2] = GLASS;
    // 四個角：玻璃下緣兩端、上緣兩端各自投到地上
    const pts = [[xa, y1], [xb, y1], [xb, y2], [xa, y2]].map(([x, y]) => [x + y * SUN_X, zWall - y * SUN_Z]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, z]) => [x, 0.004, z]), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);          // 逆時針（從上面看）才是朝上的面
    const patch = new THREE.Mesh(geo, lightMat);
    patch.raycast = () => {};
    patch.renderOrder = 1;
    scene.add(patch);
  }

  /* ----- 光線裡飄的灰塵 ----- */
  const N = 70;
  const base = [], pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const [xa, xb] = panes[i % 4];
    const y0 = GLASS[0] + Math.random() * (GLASS[1] - GLASS[0]);
    const t = Math.random();                              // 沿著光線從玻璃（0）到地上（1）
    base.push({
      x: xa + Math.random() * (xb - xa) + y0 * SUN_X * t, y: y0 * (1 - t), z: zWall - y0 * SUN_Z * t,
      ph: Math.random() * Math.PI * 2, sp: 0.2 + Math.random() * 0.4,
    });
  }
  const motesGeo = new THREE.BufferGeometry();
  motesGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(motesGeo, new THREE.PointsMaterial({
    color: 0xfff1d0, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  motes.frustumCulled = false;
  motes.raycast = () => {};
  scene.add(motes);

  const fanHead = scene.getObjectByName('fanHead');
  const blades = scene.getObjectByName('fanBlades');
  const hands = scene.getObjectByName('clock').userData.hands;
  let clockAt = -1;

  return function update(dt, time) {
    // 立扇：扇葉一直轉，風扇頭慢慢左右擺
    blades.rotation.x += dt * 22;
    fanHead.rotation.y = Math.sin(time * 0.45) * 0.55;

    // 時鐘：每秒對一次真的時間（時針、分針連續走，秒針一格一格跳）
    const now = new Date(), sec = now.getSeconds();
    if (sec !== clockAt) {
      clockAt = sec;
      const m = now.getMinutes() + sec / 60, h = (now.getHours() % 12) + m / 60;
      hands[0].rotation.z = -h / 12 * Math.PI * 2;
      hands[1].rotation.z = -m / 60 * Math.PI * 2;
      hands[2].rotation.z = -sec / 60 * Math.PI * 2;
    }

    // 灰塵：在原位附近慢慢飄、上下浮動
    for (let i = 0; i < N; i++) {
      const b = base[i], k = time * b.sp + b.ph;
      pos[i * 3] = b.x + Math.sin(k) * 0.06;
      pos[i * 3 + 1] = Math.max(0.05, b.y + Math.sin(k * 0.7) * 0.08);
      pos[i * 3 + 2] = b.z + Math.cos(k * 0.9) * 0.06;
    }
    motesGeo.attributes.position.needsUpdate = true;
  };
}
