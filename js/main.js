import * as THREE from 'three';
import { buildLivingRoom, ROOM } from './livingroom.js';
import { STYLE, OBSTACLES, WALK, ROOMS } from './kit.js';
import { initTasks } from './tasks.js';
import { DOG_FACE } from './pixelart.js';
import { initMission } from './mission.js';

const canvas = document.getElementById('scene');
// 先算到一張貼圖，再用後製決定風格：低解析度放大、色階、網點、描邊、色調
const FULL = !STYLE.h;                               // 全解析度風格
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
if (STYLE.shadows) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = STYLE.pixel ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;      // 場景是靜態的，陰影只算一次
  renderer.shadowMap.needsUpdate = true;
}
if (FULL) canvas.style.imageRendering = 'auto';
const filter = FULL ? THREE.LinearFilter : THREE.NearestFilter;
const target = new THREE.WebGLRenderTarget(320, 240, { magFilter: filter, minFilter: filter, samples: FULL ? 4 : 0 });
target.depthTexture = new THREE.DepthTexture(320, 240);
const post = new THREE.ShaderMaterial({
  uniforms: {
    tex: { value: target.texture }, depthTex: { value: target.depthTexture },
    texel: { value: new THREE.Vector2(1 / 320, 1 / 240) },
    levels: { value: STYLE.levels }, dither: { value: STYLE.dither },
    outline: { value: STYLE.outline || 0 }, tonemap: { value: STYLE.tonemap || 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tex, depthTex; uniform vec2 texel;
    uniform float levels, dither, outline, tonemap;
    varying vec2 vUv;
    float bayer(vec2 p){
      int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.));
      int i = x + y * 4;
      float m[16];
      m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
      m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
      for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16. - .5;
      return 0.;
    }
    // 深度轉成實際距離（公尺），near/far 與相機設定一致
    float dist(vec2 uv){ float z = texture2D(depthTex, uv).x * 2. - 1.; return 2. * .04 * 60. / (60. + .04 - z * (60. - .04)); }
    float lum(vec2 uv){ return dot(texture2D(tex, uv).rgb, vec3(.3, .59, .11)); }
    void main(){
      vec3 c = texture2D(tex, vUv).rgb;
      if (tonemap > .5) {                      // 柔和的底片色調、微暖
        c *= vec3(1.04, 1., .93) * .82;
        c = (c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14);
      }
      c = pow(clamp(c, 0., 1.), vec3(1. / 2.2));
      if (outline > .5) {                      // 墨線：深度或明暗突然改變的地方
        vec2 t = texel * 1.3;
        float d = dist(vUv);
        float dd = abs(dist(vUv + vec2(t.x, 0.)) + dist(vUv - vec2(t.x, 0.)) - 2. * d)
                 + abs(dist(vUv + vec2(0., t.y)) + dist(vUv - vec2(0., t.y)) - 2. * d);
        float dl = abs(lum(vUv + vec2(t.x, 0.)) - lum(vUv - vec2(t.x, 0.))) + abs(lum(vUv + vec2(0., t.y)) - lum(vUv - vec2(0., t.y)));
        float e = max(smoothstep(.015, .05, dd / d), smoothstep(.12, .3, dl) * .8);
        c = mix(c, vec3(.16, .11, .09), e);
      }
      if (levels > .5) c = floor(c * levels + .5 + bayer(gl_FragCoord.xy) * .9 * dither) / levels;
      if (tonemap > .5) { vec2 v = vUv - .5; c *= 1. - dot(v, v) * .35; }   // 四角微暗
      gl_FragColor = vec4(c, 1.);
    }`,
});
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const fog = STYLE.fog ? new THREE.Fog(0x000000, ...STYLE.fog) : null;   // 遠處變暗
const camera = new THREE.PerspectiveCamera(70, 1, 0.04, 60);
camera.rotation.order = 'YXZ';

const { dog, cat, southDoors } = buildLivingRoom(scene);
const DOG_HOME = dog.position.toArray(), DOG_YAW = dog.rotation.y;
const mission = initMission({ scene, dog, onChange: () => mission.onChange && mission.onChange() });

/* ---------- 視角 ---------- */

const HD = ROOM.D / 2, HW = ROOM.W / 2;
// yaw = 0 朝北（屋內深處），正值往西轉
const VIEWS = {
  overview: { hint: '拖曳旋轉・滾輪或雙指縮放' },
  human: { eye: 1.6, speed: 1.8, radius: 0.18, start: [1.7, 1.5], yaw: 0.72, pitch: -0.12, fov: 75,
    hint: '人的視角（從大門進來）・點一下地板走過去・拖曳環顧' },
  dog: { eye: 0.62, speed: 2.4, radius: 0.2, start: [1.72, -0.55], yaw: Math.PI * 0.8, pitch: 0.12, fov: 80,
    hint: '巴福柔的視角・點一下地板走過去・拖曳環顧' },
  cat: { eye: 0.24, speed: 1.6, radius: 0.12, start: [0.1, 1.2], yaw: 0.4, pitch: 0.25, fov: 80,
    hint: '貓的視角・點一下地板走過去・拖曳環顧' },
};

let mode = 'overview';
const orbit = { theta: 0.55, phi: 0.85, r: 7.5, target: new THREE.Vector3(0, 0.9, 0) };
const fp = { x: 0, z: 0, yaw: 0, pitch: 0 };

const hint = document.getElementById('hint');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

function setView(name) {
  mode = name;
  const v = VIEWS[name];
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  hint.textContent = v.hint;
  joystick.hidden = name === 'overview';
  stopWalk();
  scene.fog = name === 'overview' ? null : fog;
  dog.visible = name !== 'dog';
  if (mission.state.active && !mission.state.leashed) dog.position.set(...DOG_HOME);
  cat.visible = name !== 'cat';
  if (name === 'overview') {
    camera.fov = 50;
  } else {
    // 客廳用各視角自己的起點；其他房間從該房間的門口開始
    if (focus === 0) { [fp.x, fp.z] = v.start; fp.yaw = v.yaw; fp.pitch = v.pitch; }
    else { [fp.x, fp.z, fp.yaw] = stops[focus].spot; fp.pitch = 0; }
    camera.fov = v.fov;
  }
  camera.updateProjectionMatrix();
}

document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

/* ---------- 房間切換 ---------- */

const roomChip = document.getElementById('room-name');
const stops = ROOMS.filter(r => r.spot);
let focus = 0;      // 俯瞰時對準的房間

function goRoom(i) {
  focus = (i + stops.length) % stops.length;
  const room = stops[focus];
  orbit.target.set(...room.center);
  orbit.r = room.r;
  orbit.theta = room.theta;
  orbit.phi = 0.85;
  stopWalk();
  if (mode !== 'overview') {
    [fp.x, fp.z, fp.yaw] = room.spot;
    fp.pitch = 0;
  }
}
roomChip.addEventListener('click', () => goRoom(focus + 1));

function currentRoomName() {
  if (mode === 'overview') return stops[focus].name;
  const hit = ROOMS.find(({ rect: [x1, x2, z1, z2] }) => fp.x >= x1 && fp.x <= x2 && fp.z >= z1 && fp.z <= z2);
  return hit ? hit.name : '';
}

/* ---------- 拖曳環顧 / 縮放 ---------- */

const pointers = new Map();
let pinchDist = 0;

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() });
  pinchDist = 0;
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2 && mode === 'overview') {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) zoom(pinchDist / d);
    pinchDist = d;
    return;
  }
  if (mode === 'overview') {
    orbit.theta -= dx * 0.006;
    orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.006, 0.08, 1.45);
  } else {
    fp.yaw += dx * 0.005;
    fp.pitch = THREE.MathUtils.clamp(fp.pitch + dy * 0.005, -1.3, 1.3);
  }
});
const release = e => { pointers.delete(e.pointerId); pinchDist = 0; };
canvas.addEventListener('pointerup', e => {
  const p = pointers.get(e.pointerId);
  // 沒有拖曳的短按＝點擊：走到點的位置
  if (p && mode !== 'overview' && pointers.size === 1 &&
      Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 8 && performance.now() - p.t < 500) walkTo(e.clientX, e.clientY);
  release(e);
});
canvas.addEventListener('pointercancel', release);

function zoom(factor) {
  orbit.r = THREE.MathUtils.clamp(orbit.r * factor, 3, 22);
}
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (mode === 'overview') zoom(e.deltaY > 0 ? 1.1 : 0.9);
}, { passive: false });

/* ---------- 移動：鍵盤與搖桿 ---------- */

const keys = new Set();
addEventListener('keydown', e => keys.add(e.code));
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const joy = { x: 0, y: 0, id: null };
function joyUpdate(e) {
  const r = joystick.getBoundingClientRect();
  let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
  let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  joy.x = x; joy.y = y;
  stick.style.transform = `translate(${x * 32}px, ${y * 32}px)`;
}
joystick.addEventListener('pointerdown', e => {
  joy.id = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  joyUpdate(e);
});
joystick.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyUpdate(e); });
const joyEnd = e => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.x = joy.y = 0;
  stick.style.transform = '';
};
joystick.addEventListener('pointerup', joyEnd);
joystick.addEventListener('pointercancel', joyEnd);

function walkable(x, z, r) {
  if (!WALK.some(([x1, x2, z1, z2]) => x >= x1 + r && x <= x2 - r && z >= z1 + r && z <= z2 - r)) return false;
  return !OBSTACLES.some(([x1, x2, z1, z2]) => x > x1 - r && x < x2 + r && z > z1 - r && z < z2 + r);
}

/* ---------- 點擊移動：在 10 公分格線上找路，會自己繞過家具、穿過門 ---------- */

const CELL = 0.1;
const raycaster = new THREE.Raycaster();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.13, 4), new THREE.MeshBasicMaterial({ color: 0xffd23c, side: THREE.DoubleSide, fog: false }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
let path = null;

function findPath(tx, tz, r) {
  const x0 = Math.min(...WALK.map(w => w[0])), z0 = Math.min(...WALK.map(w => w[2]));
  const nx = Math.ceil((Math.max(...WALK.map(w => w[1])) - x0) / CELL) + 1;
  const nz = Math.ceil((Math.max(...WALK.map(w => w[3])) - z0) / CELL) + 1;
  const px = i => x0 + (i % nx) * CELL, pz = i => z0 + Math.floor(i / nx) * CELL;
  const ok = i => walkable(px(i), pz(i), r);
  const start = Math.round((fp.x - x0) / CELL) + Math.round((fp.z - z0) / CELL) * nx;
  const prev = new Int32Array(nx * nz).fill(-2);
  prev[start] = -1;
  const queue = [start];
  let best = start, bestD = Infinity;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], cx = i % nx, cz = Math.floor(i / nx);
    const d = Math.hypot(px(i) - tx, pz(i) - tz);
    if (d < bestD) { bestD = d; best = i; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ax = cx + dx, az = cz + dz;
      if (ax < 0 || az < 0 || ax >= nx || az >= nz) continue;
      const j = ax + az * nx;
      if (prev[j] !== -2 || !ok(j)) continue;
      if (dx && dz && (!ok(cx + dx + cz * nx) || !ok(cx + az * nx))) continue;   // 不切牆角
      prev[j] = i;
      queue.push(j);
    }
  }
  const pts = [];
  for (let i = best; i !== start && i >= 0; i = prev[i]) pts.push([px(i), pz(i)]);
  return pts.reverse();
}

function walkTo(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
  const hit = raycaster.intersectObjects(scene.children, true).find(h => h.object !== marker && h.object.visible);
  if (!hit) return;
  // 點到任務目標：夠近就直接完成，不夠近就先走過去
  let id = null;
  for (let o = hit.object; o && !id; o = o.parent) id = o.userData.interact;
  pending = id && mission.wants(id) ? { id, x: hit.point.x, z: hit.point.z } : null;
  if (pending && tryInteract()) return;
  const pts = findPath(hit.point.x, hit.point.z, VIEWS[mode].radius);
  if (!pts.length) return;
  path = pts;
  marker.position.set(pts[pts.length - 1][0], 0.03, pts[pts.length - 1][1]);
  marker.visible = true;
}

function stopWalk() { path = null; marker.visible = false; }

let pending = null;      // 正要走過去互動的任務目標
function tryInteract() {
  if (!pending || Math.hypot(pending.x - fp.x, pending.z - fp.z) > 1.7) return false;
  const { id } = pending;
  pending = null;
  stopWalk();
  mission.trigger(id);
  return true;
}

function followPath(dt) {
  const v = VIEWS[mode];
  let step = v.speed * dt;
  while (path.length && step > 0) {
    const [tx, tz] = path[0], d = Math.hypot(tx - fp.x, tz - fp.z);
    if (d <= step) { fp.x = tx; fp.z = tz; step -= d; path.shift(); }
    else { fp.x += (tx - fp.x) / d * step; fp.z += (tz - fp.z) / d * step; step = 0; }
  }
  if (pending && tryInteract()) return;
  if (!path.length) { stopWalk(); pending = null; return; }
  // 邊走邊把視線轉向前進方向
  const [lx, lz] = path[Math.min(6, path.length - 1)];
  if (Math.hypot(lx - fp.x, lz - fp.z) > 0.35 && !pointers.size) {
    const want = Math.atan2(-(lx - fp.x), -(lz - fp.z));
    const diff = Math.atan2(Math.sin(want - fp.yaw), Math.cos(want - fp.yaw));
    fp.yaw += diff * Math.min(1, dt * 4);
    fp.pitch += (0 - fp.pitch) * Math.min(1, dt * 2);
  }
  marker.rotation.z += dt * 3;
}

function move(dt) {
  const v = VIEWS[mode];
  let f = -joy.y, s = joy.x;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  const len = Math.hypot(f, s);
  if (!len) { if (path) followPath(dt); return; }
  stopWalk();          // 手動移動會取消自動行走
  pending = null;
  if (len > 1) { f /= len; s /= len; }
  const sin = Math.sin(fp.yaw), cos = Math.cos(fp.yaw);
  const dx = (-sin * f + cos * s) * v.speed * dt;
  const dz = (-cos * f - sin * s) * v.speed * dt;
  if (walkable(fp.x + dx, fp.z, v.radius)) fp.x += dx;
  if (walkable(fp.x, fp.z + dz, v.radius)) fp.z += dz;
}

/* ---------- 牽繩：巴福柔保持一段距離跟著走 ---------- */

const LEASH = 1.5;                        // 超過這個距離牠才跟上來（公尺）
const leashLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xd8452c }));
leashLine.frustumCulled = false;
leashLine.visible = false;
leashLine.raycast = () => {};
scene.add(leashLine);

function followLeash(dt) {
  const on = mission.state.leashed && mode !== 'dog';
  leashLine.visible = on;
  if (!mission.state.leashed) {
    dog.position.set(...DOG_HOME);
    dog.rotation.y = DOG_YAW;
    return;
  }
  if (!on) return;
  const dx = fp.x - dog.position.x, dz = fp.z - dog.position.z, d = Math.hypot(dx, dz);
  if (d > LEASH) {
    const step = Math.min(d - LEASH, 3 * dt);
    const nx = dog.position.x + dx / d * step, nz = dog.position.z + dz / d * step;
    if (walkable(nx, dog.position.z, 0.15)) dog.position.x = nx;
    if (walkable(dog.position.x, nz, 0.15)) dog.position.z = nz;
    // 牽繩拉太長（被家具卡住）時直接跟到身邊
    if (d > LEASH + 1.2) dog.position.set(fp.x - dx / d * LEASH, 0, fp.z - dz / d * LEASH);
  }
  if (d > 0.3) {                          // 臉朝著人
    const want = Math.atan2(-dx, -dz);
    dog.rotation.y += Math.atan2(Math.sin(want - dog.rotation.y), Math.cos(want - dog.rotation.y)) * Math.min(1, dt * 6);
  }
  // 牽繩：從手邊拉到巴福柔的脖子
  const p = leashLine.geometry.attributes.position;
  p.setXYZ(0, fp.x + Math.cos(fp.yaw) * 0.25, VIEWS[mode].eye - 0.55, fp.z - Math.sin(fp.yaw) * 0.25);
  p.setXYZ(1, dog.position.x - Math.sin(dog.rotation.y) * 0.32, 0.66, dog.position.z - Math.cos(dog.rotation.y) * 0.32);
  p.needsUpdate = true;
}

/* ---------- 主迴圈 ---------- */

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const rh = FULL ? Math.round(h * Math.min(devicePixelRatio, 2)) : STYLE.h;
  const rw = Math.max(160, Math.round(rh * w / h));
  renderer.setSize(rw, rh, false);
  target.setSize(rw, rh);
  post.uniforms.texel.value.set(1 / rw, 1 / rh);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mode === 'overview') {
    const { theta, phi, r, target } = orbit;
    // 直式螢幕拉遠一點，讓整個客廳都看得到
    const dist = r * Math.max(1, 1.15 / camera.aspect);
    camera.position.set(
      target.x + dist * Math.sin(phi) * Math.sin(theta),
      target.y + dist * Math.cos(phi),
      target.z + dist * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    // 從大門外側俯瞰時先隱藏落地門，才不會擋住室內
    southDoors.visible = focus !== 0 || camera.position.z < HD;
  } else {
    move(dt);
    followLeash(dt);
    southDoors.visible = true;
    camera.position.set(fp.x, VIEWS[mode].eye, fp.z);
    camera.rotation.set(fp.pitch, fp.yaw, 0);
  }
  const label = currentRoomName();
  if (label && roomChip.textContent !== label + ' ▸') roomChip.textContent = label + ' ▸';
  if (mode !== 'overview') {      // 走到哪個房間，俯瞰就跟著對準哪個房間
    const i = stops.findIndex(r => r.name === label);
    if (i >= 0 && i !== focus) { focus = i; orbit.target.set(...stops[i].center); orbit.r = stops[i].r; }
  }
  mission.update(clock.elapsedTime);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  requestAnimationFrame(frame);
}

const portrait = document.getElementById('portrait');
portrait.width = DOG_FACE.width; portrait.height = DOG_FACE.height;
portrait.getContext('2d').drawImage(DOG_FACE, 0, 0);

const renderTasks = initTasks(mission);
mission.onChange = renderTasks;
setView('overview');
frame();

// 方便除錯與之後擴充
window.__app = { setView, goRoom, fp, orbit, mission };
