import * as THREE from 'three';
import { buildLivingRoom, ROOM } from './livingroom.js';
import { animatePet } from './pets.js';
import { STYLE, ROOMS } from './kit.js';
import { walkable, findPath } from './nav.js';
import { initTasks } from './tasks.js';
import { DOG_FACE } from './pixelart.js';
import { initMission } from './mission.js';
import { initClean } from './clean.js';
import { initFeed } from './feed.js';
import { initGate } from './gate.js';
import { initWander } from './wander.js';
import { initLitter, initCatFeed } from './side.js';
import { initFlow } from './flow.js';
import { initPlay } from './play.js';

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

const { dog, cat, kitten, southDoors } = buildLivingRoom(scene);
const mission = initMission({ scene, dog, onChange: () => missionChanged() });   // 任務一：帶狗出門
const clean = initClean({ scene });                                                  // 任務二：清潔時間
clean.onChange = () => missionChanged();
const feed = initFeed({ scene, dog });                                               // 任務三：餵狗
feed.onChange = () => missionChanged();
const missions = [mission, clean, feed];
// 支線任務
const litter = initLitter({ scene });
const catFeed = initCatFeed({ scene });
const sides = [litter, catFeed];
for (const m of sides) m.onChange = () => missionChanged();
let renderTasks = () => {}, flow = null;
function missionChanged() {
  renderTasks();
  if (flow) flow.check();
  renderer.shadowMap.needsUpdate = true;     // 任務物件出現或消失，陰影要重算
}

// 廚房柵欄：平常關著，點一下開關；開著離開廚房會跳出警示
const alertBox = document.getElementById('alert');
const gate = initGate({ scene, onChange: () => {
  alertBox.hidden = !gate.state.warning;
  wander.replan();
} });
const clickables = [...missions, ...sides, gate];

// 巴福柔和兩隻貓在屋裡到處走。巴福柔被牽著、自己去吃飯、或等著被繫牽繩的時候不亂走；
// 用牠們的視角時，那隻本身也不動
const wander = initWander([
  { obj: dog, r: 0.25, front: 0.55, speed: 0.8, rest: [3, 9],
    free: () => mode !== 'dog' && !mission.state.leashed && !feed.owns() && !mission.wants('dog') && !play.busy() },
  { obj: cat, r: 0.12, front: 0.28, speed: 0.6, rest: [4, 14], free: () => mode !== 'cat' },
  { obj: kitten, r: 0.1, front: 0.22, speed: 0.75, rest: [2, 8], free: () => true },
], () => (mode === 'overview' ? null : { x: fp.x, z: fp.z, r: VIEWS[mode].radius + 0.1 }));

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

// 和巴福柔互動（握手、趴下、踹人、被人騎、點穴）：沒被牽著、沒在吃飯、任務沒有要用到牠的時候才行
const play = initPlay({ dog, fp, walkable,
  canPlay: () => mode !== 'overview' && mode !== 'dog' && !mission.state.leashed && !feed.owns() && !mission.wants('dog') });
clickables.push(play);

const stunBox = document.getElementById('stun');
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

/* ---------- 點擊移動：在 10 公分格線上找路，會自己繞過家具、穿過門 ---------- */

const raycaster = new THREE.Raycaster();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.13, 4), new THREE.MeshBasicMaterial({ color: 0xffd23c, side: THREE.DoubleSide, fog: false }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
let path = null;

function walkTo(clientX, clientY) {
  if (play.state.stunned) return;
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
  const hit = raycaster.intersectObjects(scene.children, true).find(h => h.object !== marker && shown(h.object));
  if (!hit) return;
  // 點到任務目標：夠近就直接完成，不夠近就先走過去
  let id = null;
  for (let o = hit.object; o && !id; o = o.parent) id = o.userData.interact;
  const m = id && clickables.find(m => m.wants(id));
  pending = m ? { m, id, x: hit.point.x, z: hit.point.z } : null;
  if (m && m.notice) m.notice(id);
  if (pending && tryInteract()) return;
  const pts = findPath(fp.x, fp.z, hit.point.x, hit.point.z, VIEWS[mode].radius);
  if (!pts.length) return;
  path = pts;
  marker.position.set(pts[pts.length - 1][0], 0.03, pts[pts.length - 1][1]);
  marker.visible = true;
}

// 物件本身與所有上層都看得見才算（藏起來的任務物件點不到）
function shown(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function stopWalk() { path = null; marker.visible = false; }

let pending = null;      // 正要走過去互動的任務目標
function tryInteract() {
  if (!pending || Math.hypot(pending.x - fp.x, pending.z - fp.z) > 1.7) return false;
  const { m, id } = pending;
  pending = null;
  stopWalk();
  m.trigger(id);
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

// 巴福柔沿著人走過的足跡跟上（足跡都是走得到的地方，所以不會穿過家具或牆）
const trail = [];
function followLeash(dt, time) {
  const on = mission.state.leashed && mode !== 'dog';
  leashLine.visible = on;
  if (!on) { trail.length = 0; return; }   // 沒牽著：巴福柔自己到處走（wander.js）
  const dp = dog.position;
  if (!trail.length) trail.push(...findPath(dp.x, dp.z, fp.x, fp.z, 0.2));   // 剛繫上：先找一條走到人身邊的路
  const end = trail[trail.length - 1];
  if (!end || Math.hypot(fp.x - end[0], fp.z - end[1]) > 0.1) trail.push([fp.x, fp.z]);
  // 從巴福柔沿著足跡到人的距離
  let len = 0, px = dp.x, pz = dp.z;
  for (const [x, z] of trail) { len += Math.hypot(x - px, z - pz); px = x; pz = z; }
  let moving = false;
  if (len > LEASH) {
    let step = Math.min(len - LEASH, (len > LEASH + 1 ? 4 : 2.2) * dt);
    moving = step > 0.001;
    while (trail.length > 1 && step > 0) {
      const [tx, tz] = trail[0], dx = tx - dp.x, dz = tz - dp.z, d = Math.hypot(dx, dz);
      if (d > 0.02) {
        const want = Math.atan2(-dx, -dz);
        dog.rotation.y += Math.atan2(Math.sin(want - dog.rotation.y), Math.cos(want - dog.rotation.y)) * Math.min(1, dt * 8);
      }
      if (d <= step) { dp.x = tx; dp.z = tz; step -= d; trail.shift(); }
      else { dp.x += dx / d * step; dp.z += dz / d * step; step = 0; }
    }
  }
  const dx = fp.x - dp.x, dz = fp.z - dp.z;
  if (!moving && Math.hypot(dx, dz) > 0.3) {     // 停下來時臉朝著人
    const want = Math.atan2(-dx, -dz);
    dog.rotation.y += Math.atan2(Math.sin(want - dog.rotation.y), Math.cos(want - dog.rotation.y)) * Math.min(1, dt * 6);
  }
  // 牽繩：從手邊拉到巴福柔的脖子
  const p = leashLine.geometry.attributes.position;
  p.setXYZ(0, fp.x + Math.cos(fp.yaw) * 0.25, VIEWS[mode].eye - 0.55, fp.z - Math.sin(fp.yaw) * 0.25);
  p.setXYZ(1, dp.x - Math.sin(dog.rotation.y) * 0.22, 0.66, dp.z - Math.cos(dog.rotation.y) * 0.22);
  p.needsUpdate = true;
}

/* ---------- 目標方向箭頭：沿著走得到的路指出下一步往哪走 ---------- */

const compass = document.getElementById('compass');
const compassArrow = document.getElementById('compass-arrow');
const compassText = document.getElementById('compass-text');
const roomAt = (x, z) => (ROOMS.find(({ rect: [x1, x2, z1, z2] }) => x >= x1 && x <= x2 && z >= z1 && z <= z2) || {}).name || '';
let guide = null, guideAt = -1;     // guide：路線上前方約 1.2m 的點；每 0.4 秒重算一次

function updateCompass(time) {
  const active = [...missions, ...sides].find(m => m.state.active);
  const pts = active && mode !== 'overview' ? active.pointers.filter(p => p.visible) : [];
  if (!pts.length) { compass.hidden = true; guide = null; return; }
  const t = pts.reduce((a, b) => (Math.hypot(a.position.x - fp.x, a.position.z - fp.z) <= Math.hypot(b.position.x - fp.x, b.position.z - fp.z) ? a : b)).position;
  const dist = Math.hypot(t.x - fp.x, t.z - fp.z);
  const there = roomAt(t.x, t.z), here = currentRoomName();
  if (time - guideAt > 0.4) {
    guideAt = time;
    const route = findPath(fp.x, fp.z, t.x, t.z, VIEWS[mode].radius);
    let left = 1.2, px = fp.x, pz = fp.z;
    guide = [t.x, t.z];
    for (const [x, z] of route) { left -= Math.hypot(x - px, z - pz); px = x; pz = z; if (left <= 0) { guide = [x, z]; break; } }
  }
  const dx = guide[0] - fp.x, dz = guide[1] - fp.z;
  const fwd = -Math.sin(fp.yaw) * dx - Math.cos(fp.yaw) * dz, right = Math.cos(fp.yaw) * dx - Math.sin(fp.yaw) * dz;
  compassArrow.style.transform = `rotate(${Math.atan2(right, fwd)}rad)`;
  compassText.textContent = there && there !== here ? `目標在${there}` : dist < 1.7 ? '就在附近' : `目標在 ${dist.toFixed(1)} 公尺外`;
  compass.hidden = false;
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
let lastRoom = '';
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
    if (play.state.stunned) { stopWalk(); pending = null; } else move(dt);   // 被點穴：動不了
    followLeash(dt, clock.elapsedTime);
    southDoors.visible = true;
    play.update(dt, clock.elapsedTime);
    const riding = play.state.riding;
    if (riding) {                           // 騎在巴福柔背上：牠跟著人的位置和方向走，視線降到牠背上的高度
      dog.position.set(fp.x, 0, fp.z);
      dog.rotation.y += Math.atan2(Math.sin(fp.yaw - dog.rotation.y), Math.cos(fp.yaw - dog.rotation.y)) * Math.min(1, dt * 6);
    }
    const jolt = play.state.shake;          // 被踹的時候鏡頭晃一下
    const tip = play.state.tip;             // 被點穴：整個人僵直側倒，視線倒到地上
    const eye = VIEWS[mode].eye * (1 - tip) + Math.min(VIEWS[mode].eye, 0.35) * tip;
    camera.position.set(fp.x + (riding ? Math.sin(fp.yaw) * 0.12 : 0),
      (riding ? 1.2 : eye) + Math.sin(clock.elapsedTime * 47) * 0.04 * jolt, fp.z + (riding ? Math.cos(fp.yaw) * 0.12 : 0));
    camera.rotation.set(fp.pitch, fp.yaw, Math.sin(clock.elapsedTime * 38) * 0.09 * jolt + tip * 1.25);
  }
  const label = currentRoomName();
  if (label && roomChip.textContent !== label + ' ▸') roomChip.textContent = label + ' ▸';
  if (mode !== 'overview') {      // 走到哪個房間，俯瞰就跟著對準哪個房間
    const i = stops.findIndex(r => r.name === label);
    if (i >= 0 && i !== focus) { focus = i; orbit.target.set(...stops[i].center); orbit.r = stops[i].r; }
  }
  for (const m of [...missions, ...sides]) m.update(clock.elapsedTime);
  flow.update();
  stunBox.classList.toggle('on', play.state.stunned);
  updateCompass(clock.elapsedTime);
  wander.update(dt, clock.elapsedTime);
  for (const o of [dog, cat, kitten]) animatePet(o, dt, clock.elapsedTime);    // 走路、搖尾巴、趴下等動作
  if (gate.update(dt)) renderer.shadowMap.needsUpdate = true;   // 柵欄轉動中，陰影跟著重算
  // 從廚房走到別的房間時，柵欄還開著就警示
  if (mode !== 'overview' && label) {
    if (lastRoom === '廚房' && label !== '廚房') gate.leftKitchen();
    lastRoom = label;
  }
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  requestAnimationFrame(frame);
}

const portrait = document.getElementById('portrait');
portrait.width = DOG_FACE.width; portrait.height = DOG_FACE.height;
portrait.getContext('2d').drawImage(DOG_FACE, 0, 0);

// 開始一個任務：同時只做一個；從俯瞰開始的話直接切到人的視角
function startQuest(m) {
  for (const o of [...missions, ...sides]) if (o !== m) o.stop();
  m.start();
  if (mode === 'overview') setView('human');
}
renderTasks = initTasks(missions, sides, startQuest);
flow = initFlow({ quests: { walk: mission, clean, feed, catFeed, litter }, startQuest, setView, fp });
setView('overview');
frame();

// 方便除錯與之後擴充
window.__app = { setView, goRoom, fp, orbit, mission, clean, feed, litter, catFeed, gate, play, dog, cat, kitten };
