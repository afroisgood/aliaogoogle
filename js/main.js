import * as THREE from 'three';
import { buildLivingRoom, ROOM, DOORWAY, CORRIDOR, OBSTACLES } from './livingroom.js';
import { initTasks } from './tasks.js';
import { DOG_FACE } from './pixelart.js';

const canvas = document.getElementById('scene');
// 復古 FPS 風格：低解析度算圖後放大，並把顏色壓成有限色階＋網點抖色
const RENDER_H = 240;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
const target = new THREE.WebGLRenderTarget(320, RENDER_H, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tex: { value: target.texture } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tex; varying vec2 vUv;
    float bayer(vec2 p){
      int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.));
      int i = x + y * 4;
      float m[16];
      m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
      m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
      for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16. - .5;
      return 0.;
    }
    void main(){
      vec3 c = pow(clamp(texture2D(tex, vUv).rgb, 0., 1.), vec3(1. / 2.2));
      float levels = 7.;
      c = floor(c * levels + .5 + bayer(gl_FragCoord.xy) * .9) / levels;
      gl_FragColor = vec4(c, 1.);
    }`,
})));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const fog = new THREE.Fog(0x000000, 2.5, 13);   // 遠處變暗
const camera = new THREE.PerspectiveCamera(70, 1, 0.04, 60);
camera.rotation.order = 'YXZ';

const { dog, cat, southDoors } = buildLivingRoom(scene);

/* ---------- 視角 ---------- */

const HD = ROOM.D / 2, HW = ROOM.W / 2;
// yaw = 0 朝北（屋內深處），正值往西轉
const VIEWS = {
  overview: { hint: '拖曳旋轉・滾輪或雙指縮放' },
  human: { eye: 1.6, speed: 1.8, radius: 0.18, start: [1.7, 1.5], yaw: 0.72, pitch: -0.12, fov: 75,
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
  scene.fog = name === 'overview' ? null : fog;
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
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const rw = Math.max(160, Math.round(RENDER_H * w / h));
  renderer.setSize(rw, RENDER_H, false);
  target.setSize(rw, RENDER_H);
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
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  requestAnimationFrame(frame);
}

const portrait = document.getElementById('portrait');
portrait.width = DOG_FACE.width; portrait.height = DOG_FACE.height;
portrait.getContext('2d').drawImage(DOG_FACE, 0, 0);

initTasks();
setView('overview');
frame();

// 方便除錯與之後擴充
window.__app = { setView, fp, orbit };
