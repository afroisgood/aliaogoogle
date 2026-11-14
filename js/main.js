import * as THREE from 'three';
import { buildLivingRoom, ROOM } from './livingroom.js';
import { animatePet } from './pets.js';
import { STYLE, ROOMS, SPACE } from './kit.js';
import { walkable, findPath, roomAt, advance, heading, turnAngle } from './nav.js';
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
import { relayout } from './layout.js';
import { openGallery } from './walk.js';
import { initTV } from './tv.js';
import { play as sound, playTarget, buzz, initSoundToggle } from './sound.js';
import { initFeedback } from './feedback.js';
import { createRenderer } from './post.js';
import { initLeash } from './leash.js';
import { initCompass } from './compass.js';

const canvas = document.getElementById('scene');
const { renderer, resize: resizeRenderer, render } = createRenderer(canvas);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const fog = STYLE.fog ? new THREE.Fog(0x000000, ...STYLE.fog.map(d => d * SPACE)) : null;   // 遠處變暗
const camera = new THREE.PerspectiveCamera(70, 1, 0.04, 60);
camera.rotation.order = 'YXZ';

const { dog, cat, kitten, southDoors } = buildLivingRoom(scene);
const mission = initMission({ scene, dog });       // 任務一：帶狗出門
const clean = initClean({ scene });               // 任務二：清潔時間
const feed = initFeed({ scene, dog });            // 任務三：餵狗
const missions = [mission, clean, feed];
const litter = initLitter({ scene });             // 支線任務一：清理貓砂
const catFeed = initCatFeed({ scene });           // 支線任務二：餵貓
const sides = [litter, catFeed];
const quests = [...missions, ...sides];
for (const m of quests) m.onChange = () => missionChanged();
let renderTasks = () => {}, flow = null;
const feedback = initFeedback({ quests, dog });   // 步驟完成的提示音、任務完成的彩帶
function missionChanged() {
  feedback.changed();
  renderTasks();
  if (flow) flow.check();
  renderer.shadowMap.needsUpdate = true;     // 任務物件出現或消失，陰影要重算
}

// 房間和任務物件都建好了：把屋子換算成實際大小（房間放大、家具維持原尺寸）
relayout(scene);

// 廚房柵欄：平常關著，點一下開關；開著離開廚房會跳出警示
const alertBox = document.getElementById('alert');
const gate = initGate({ scene, onChange: () => {
  if (gate.state.warning && alertBox.hidden) { sound('alarm'); buzz([100, 80, 100]); }
  alertBox.hidden = !gate.state.warning;
  wander.replan();
} });
const clickables = [...quests, gate];

// 巴福柔和兩隻貓在屋裡到處走。巴福柔被牽著、自己去吃飯、或等著被繫牽繩的時候不亂走；
// 用牠們的視角時，那隻本身也不動
const wander = initWander([
  { obj: dog, r: 0.25, front: 0.55, speed: 1.0, rest: [3, 9],
    free: () => mode !== 'dog' && !mission.state.leashed && !feed.owns() && !mission.wants('dog') && !play.busy() },
  { obj: cat, r: 0.12, front: 0.28, speed: 0.75, rest: [4, 14], free: () => mode !== 'cat' },
  { obj: kitten, r: 0.1, front: 0.22, speed: 0.9, rest: [2, 8], free: () => true },
], () => (mode === 'overview' ? null : { x: fp.x, z: fp.z, r: VIEWS[mode].radius + 0.1 }));

/* ---------- 視角 ---------- */

const HD = ROOM.D / 2 * SPACE;         // 客廳南牆（大門）實際的 z
// yaw = 0 朝北（屋內深處），正值往西轉
const VIEWS = {
  overview: { hint: '拖曳旋轉・滾輪或雙指縮放' },
  human: { eye: 1.6, speed: 2.2, radius: 0.18, start: [1.7, 1.5], yaw: 0.35, pitch: -0.1, fov: 75,
    hint: '人的視角（從大門進來）・點一下地板走過去・拖曳環顧' },
  dog: { eye: 0.62, speed: 3.0, radius: 0.2, start: [1.72, -0.55], yaw: Math.PI * 0.8, pitch: 0.12, fov: 80,
    hint: '巴福柔的視角・點一下地板走過去・拖曳環顧' },
  cat: { eye: 0.24, speed: 2.0, radius: 0.12, start: [0.1, 1.2], yaw: 0.4, pitch: 0.25, fov: 80,
    hint: '貓的視角・點一下地板走過去・拖曳環顧' },
};

let mode = 'overview';
const orbit = { theta: 0.55, phi: 0.85, r: 7.5 * SPACE, target: new THREE.Vector3(0, 0.9, 0) };
const fp = { x: 0, z: 0, yaw: 0, pitch: 0 };

// 和巴福柔互動（握手、趴下、踹人、被人騎、點穴）：沒被牽著、沒在吃飯、任務沒有要用到牠的時候才行
const play = initPlay({ dog, fp, walkable,
  canPlay: () => mode !== 'overview' && mode !== 'dog' && !mission.state.leashed && !feed.owns() && !mission.wants('dog') });
clickables.push(play);

// 客廳電視：走到前面會問要不要看「災」。和巴福柔互動、或有對話卡片時先不問
const tv = initTV({ scene, fp,
  active: () => mode !== 'overview' && !play.state.open && document.getElementById('card').hidden && document.getElementById('walk').hidden });
const stunBox = document.getElementById('stun');
const hint = document.getElementById('hint');

function setView(name) {
  mode = name;
  const v = VIEWS[name];
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  hint.textContent = v.hint;
  stopWalk();
  scene.fog = name === 'overview' ? null : fog;
  dog.visible = name !== 'dog';
  cat.visible = name !== 'cat';
  if (name === 'overview') {
    camera.fov = 50;
  } else {
    // 客廳用各視角自己的起點；其他房間從該房間的門口開始
    if (focus === 0) { [fp.x, fp.z] = v.start.map(n => n * SPACE); fp.yaw = v.yaw; fp.pitch = v.pitch; }
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
document.getElementById('gallery-btn').addEventListener('click', openGallery);   // 隨時看散步指引圖集

const currentRoomName = () => (mode === 'overview' ? stops[focus].name : roomAt(fp.x, fp.z));

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
  orbit.r = THREE.MathUtils.clamp(orbit.r * factor, 3, 22 * SPACE);
}
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (mode === 'overview') zoom(e.deltaY > 0 ? 1.1 : 0.9);
}, { passive: false });

/* ---------- 移動：鍵盤（觸控用點地板走路） ---------- */

const keys = new Set();
addEventListener('keydown', e => keys.add(e.code));
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());


/* ---------- 點擊移動：在 10 公分格線上找路，會自己繞過家具、穿過門 ---------- */

const raycaster = new THREE.Raycaster();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.13, 4), new THREE.MeshBasicMaterial({ color: 0xffd23c, side: THREE.DoubleSide, fog: false }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
let path = null;

function walkTo(clientX, clientY) {
  if (play.state.still) return;
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
  if (!pending || Math.hypot(pending.x - fp.x, pending.z - fp.z) > 1.9) return false;
  const { m, id } = pending;
  pending = null;
  stopWalk();
  if (m.wants(id)) { if (m === play) sound('woof'); else playTarget(id); }
  m.trigger(id);
  return true;
}

function followPath(dt) {
  const v = VIEWS[mode];
  advance(fp, path, v.speed * play.speed() * dt);
  if (pending && tryInteract()) return;
  if (!path.length) { stopWalk(); pending = null; return; }
  // 邊走邊把視線轉向前進方向
  const [lx, lz] = path[Math.min(6, path.length - 1)];
  if (Math.hypot(lx - fp.x, lz - fp.z) > 0.35 && !pointers.size) {
    fp.yaw = turnAngle(fp.yaw, heading(lx - fp.x, lz - fp.z), dt * 4);
    fp.pitch += (0 - fp.pitch) * Math.min(1, dt * 2);
  }
  marker.rotation.z += dt * 3;
}

function move(dt) {
  const v = VIEWS[mode];
  let f = 0, s = 0;
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
  const dx = (-sin * f + cos * s) * v.speed * play.speed() * dt;
  const dz = (-cos * f - sin * s) * v.speed * play.speed() * dt;
  if (walkable(fp.x + dx, fp.z, v.radius)) fp.x += dx;
  if (walkable(fp.x, fp.z + dz, v.radius)) fp.z += dz;
}

/* ---------- 牽繩與目標方向箭頭 ---------- */

const updateLeash = initLeash({ scene, dog, fp,
  on: () => mission.state.leashed && mode !== 'dog', handY: () => VIEWS[mode].eye - 0.55 });
const updateCompass = initCompass({ quests, fp, radius: () => (mode === 'overview' ? null : VIEWS[mode].radius) });

/* ---------- 主迴圈 ---------- */

const resize = () => resizeRenderer(camera);
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
    if (play.state.still) { stopWalk(); pending = null; } else move(dt);   // 巴福柔幫忙點穴時站著不動
    updateLeash(dt);
    southDoors.visible = true;
    play.update(dt, clock.elapsedTime);
    const riding = play.state.riding;
    if (riding) {                           // 騎在巴福柔背上：牠跟著人的位置和方向走，視線降到牠背上的高度
      dog.position.set(fp.x, 0, fp.z);
      dog.rotation.y = turnAngle(dog.rotation.y, fp.yaw, dt * 6);
    }
    const jolt = play.state.shake;          // 被踹的時候鏡頭晃一下
    camera.position.set(fp.x + (riding ? Math.sin(fp.yaw) * 0.12 : 0),
      (riding ? 1.2 : VIEWS[mode].eye) + Math.sin(clock.elapsedTime * 47) * 0.04 * jolt, fp.z + (riding ? Math.cos(fp.yaw) * 0.12 : 0));
    camera.rotation.set(fp.pitch, fp.yaw, Math.sin(clock.elapsedTime * 38) * 0.09 * jolt);
  }
  const label = currentRoomName();
  if (label && roomChip.textContent !== label + ' ▸') roomChip.innerHTML = `${label}<span class="arr"> ▸</span>`;
  if (mode !== 'overview') {      // 走到哪個房間，俯瞰就跟著對準哪個房間
    const i = stops.findIndex(r => r.name === label);
    if (i >= 0 && i !== focus) { focus = i; orbit.target.set(...stops[i].center); orbit.r = stops[i].r; }
  }
  for (const m of quests) m.update(clock.elapsedTime);
  flow.update();
  tv.update(dt);
  stunBox.classList.toggle('on', play.state.still);        // 被按摩時畫面泛一層暖色
  updateCompass(clock.elapsedTime);
  wander.update(dt, clock.elapsedTime);
  for (const o of [dog, cat, kitten]) animatePet(o, dt, clock.elapsedTime);    // 走路、搖尾巴、趴下等動作
  if (gate.update(dt)) renderer.shadowMap.needsUpdate = true;   // 柵欄轉動中，陰影跟著重算
  // 從廚房走到別的房間時，柵欄還開著就警示
  if (mode !== 'overview' && label) {
    if (lastRoom === '廚房' && label !== '廚房') gate.leftKitchen();
    lastRoom = label;
  }
  render(scene, camera);
  requestAnimationFrame(frame);
}

const portrait = document.getElementById('portrait');
portrait.width = DOG_FACE.width; portrait.height = DOG_FACE.height;
portrait.getContext('2d').drawImage(DOG_FACE, 0, 0);

// 開始一個任務：同時只做一個；從俯瞰開始的話直接切到人的視角
function startQuest(m) {
  for (const o of quests) if (o !== m) o.stop();
  m.start();
  if (mode === 'overview') setView('human');
}
renderTasks = initTasks(missions, sides, startQuest);
flow = initFlow({ quests: { walk: mission, clean, feed, catFeed, litter }, startQuest, setView, fp });
initSoundToggle(document.getElementById('sound-btn'));
setView('human');      // 一打開就是人的視角，從大門進來
frame();

// 方便除錯與之後擴充
window.__app = { setView, goRoom, fp, orbit, camera, mission, clean, feed, litter, catFeed, gate, play, tv, dog, cat, kitten };
