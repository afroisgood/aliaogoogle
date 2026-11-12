import * as THREE from 'three';
import { buildLivingRoom, ROOM, DOORWAY, CORRIDOR, OBSTACLES } from './livingroom.js';
import { initTasks } from './tasks.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1714);
const camera = new THREE.PerspectiveCamera(70, 1, 0.04, 60);
camera.rotation.order = 'YXZ';

const { dog, cat, southDoors } = buildLivingRoom(scene);

/* ---------- 視角 ---------- */

const HD = ROOM.D / 2, HW = ROOM.W / 2;
// yaw = 0 朝北（屋內深處），正值往西轉
const VIEWS = {
  overview: { hint: '拖曳旋轉・滾輪或雙指縮放' },
  human: { eye: 1.6, speed: 1.8, radius: 0.22, start: [1.7, 1.5], yaw: 0.72, pitch: -0.12, fov: 75,
    hint: '人的視角（從大門進來）・拖曳環顧・搖桿或 WASD 移動' },
  dog: { eye: 0.62, speed: 2.4, radius: 0.2, start: [1.72, -0.55], yaw: Math.PI * 0.8, pitch: 0.12, fov: 80,
    hint: '巴福柔的視角・拖曳環顧・搖桿或 WASD 移動' },
  cat: { eye: 0.24, speed: 1.6, radius: 0.12, start: [0.1, 1.2], yaw: 0.4, pitch: 0.25, fov: 80,
    hint: '貓的視角・拖曳環顧・搖桿或 WASD 移動' },
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
  dog.visible = name !== 'dog';
  cat.visible = name !== 'cat';
  if (name === 'overview') {
    camera.fov = 50;
  } else {
    [fp.x, fp.z] = v.start;
    fp.yaw = v.yaw;
    fp.pitch = v.pitch;
    camera.fov = v.fov;
  }
  camera.updateProjectionMatrix();
}

document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

/* ---------- 拖曳環顧 / 縮放 ---------- */

const pointers = new Map();
let pinchDist = 0;

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

function zoom(factor) {
  orbit.r = THREE.MathUtils.clamp(orbit.r * factor, 3, 16);
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
  const inRoom = Math.abs(x) <= HW - r && Math.abs(z) <= HD - r;
  const inDoor = x >= DOORWAY.x1 + r && x <= DOORWAY.x2 - r && z <= -HD + r + 0.3 && z >= -HD - 0.3;
  const inCorridor = x >= CORRIDOR.x1 + r && x <= CORRIDOR.x2 - r && z <= -HD - 0.2 && z >= -HD - CORRIDOR.len + r;
  if (!inRoom && !inDoor && !inCorridor) return false;
  return !OBSTACLES.some(([x1, x2, z1, z2]) => x > x1 - r && x < x2 + r && z > z1 - r && z < z2 + r);
}

function move(dt) {
  const v = VIEWS[mode];
  let f = -joy.y, s = joy.x;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  const len = Math.hypot(f, s);
  if (!len) return;
  if (len > 1) { f /= len; s /= len; }
  const sin = Math.sin(fp.yaw), cos = Math.cos(fp.yaw);
  const dx = (-sin * f + cos * s) * v.speed * dt;
  const dz = (-cos * f - sin * s) * v.speed * dt;
  if (walkable(fp.x + dx, fp.z, v.radius)) fp.x += dx;
  if (walkable(fp.x, fp.z + dz, v.radius)) fp.z += dz;
}

/* ---------- 主迴圈 ---------- */

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
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
    southDoors.visible = camera.position.z < HD;
  } else {
    move(dt);
    southDoors.visible = true;
    camera.position.set(fp.x, VIEWS[mode].eye, fp.z);
    camera.rotation.set(fp.pitch, fp.yaw, 0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

initTasks();
setView('overview');
frame();

// 方便除錯與之後擴充
window.__app = { setView, fp, orbit };
