import * as THREE from 'three';
import { std, box, ball } from './kit.js';
import { BATH } from './dogroom.js';
import { CORRIDOR } from './livingroom.js';

// 任務二：清潔時間。
// 用過的尿布墊有三塊：走廊（第二、第三個房門中間）一塊，狗房廁所地上與淋浴間各一塊。
// 新尿布墊放在廁所東牆毛巾架上方的層架；舊尿布墊最後從廚房後門拿出去丟。
// 便便每次開始任務時隨機出現 0～2 坨，沒有就跳過「撿便便」和「沖馬桶」。
export const CLEAN = {
  id: 'clean',
  title: '任務二：清潔時間',
  steps: [
    { id: 'pickup', text: '撿起三塊用過的尿布墊' },
    { id: 'replace', text: '從廁所層架拿新尿布墊，鋪回原位' },
    { id: 'poop', text: '撿起便便（如果有）' },
    { id: 'flush', text: '把便便包起來，丟進馬桶沖掉' },
    { id: 'trash', text: '從廚房後門把舊尿布墊拿出去丟' },
  ],
};

// 三塊尿布墊的位置：[x, z, 寬, 長, 轉角]
const PADS = [
  [(CORRIDOR.x1 + CORRIDOR.x2) / 2 - 0.05, -7.5, 0.5, 0.9, 0],     // 走廊：主臥室門與狗房門中間
  [0.4, BATH.zN + 0.95, 0.45, 0.9, 0.2],                              // 廁所地上
  [0.4, BATH.zS - 0.5, 0.7, 0.5, 0],                                  // 淋浴間
];
// 便便可能出現的位置（不在尿布墊上）
const POOP_SPOTS = [[-0.6, -8.7], [0.3, -9.4], [-1.0, -10.5], [1.85, -8.8], [1.45, -6.4]];

const DONE_KEY = 'bafurou-missions-done';
const loadDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch { return {}; } };

export function initClean({ scene }) {
  const state = { active: false, at: 0, done: !!loadDone()[CLEAN.id], finished: 0 };
  const invisible = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const objects = {};
  const world = scene.getObjectByName('world');      // 任務物件放進屋子的群組，跟著一起放大

  /* ----- 尿布墊：髒的（有黃色污漬）、乾淨的，以及鋪新墊時的半透明位置提示 ----- */
  const padMat = std(0xf4f4f2, { roughness: 1 });
  const stainMat = std(0xc8ad62, { roughness: 1 });
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.35, depthWrite: false });
  const pads = PADS.map(([x, z, w, l, r], i) => {
    const pad = new THREE.Group();
    pad.position.set(x, 0, z);
    pad.rotation.y = r;
    box(pad, w, 0.012, l, padMat, 0, 0.012, 0).castShadow = false;
    box(pad, w - 0.04, 0.004, l - 0.04, std(0x9cc6e0, { roughness: 1 }), 0, 0.017, 0).castShadow = false;
    const stain = new THREE.Group();
    ball(stain, w * 0.24, stainMat, 0.03, 0.02, l * 0.08, 1, 0.02, 1.3).castShadow = false;
    ball(stain, w * 0.16, stainMat, -w * 0.18, 0.02, -l * 0.2, 1, 0.02, 1).castShadow = false;
    pad.add(stain);
    pad.userData = { interact: `pad${i}`, stain };
    world.add(pad);
    objects[`pad${i}`] = pad;

    const ghost = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, l), ghostMat);
    ghost.position.set(x, 0.012, z);
    ghost.rotation.y = r;
    ghost.userData.interact = `spot${i}`;
    ghost.visible = false;
    world.add(ghost);
    objects[`spot${i}`] = ghost;
    return { pad, stain, ghost };
  });

  /* ----- 便便：開始任務時才隨機放 ----- */
  const poopMat = std(0x5a3a1e, { roughness: 0.7 });
  const poops = POOP_SPOTS.map(([x, z], i) => {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    ball(p, 0.06, poopMat, 0, 0.03, 0, 1.3, 0.6, 1);
    ball(p, 0.045, poopMat, 0.01, 0.065, 0.005, 1.2, 0.7, 1);
    ball(p, 0.028, poopMat, 0.015, 0.095, 0.01, 1, 0.9, 1);
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), invisible);
    hitbox.position.y = 0.12;
    p.add(hitbox);
    p.userData.interact = `poop${i}`;
    p.visible = false;
    world.add(p);
    objects[`poop${i}`] = p;
    return p;
  });

  // 場景裡現成的東西：廁所層架的新尿布墊、馬桶、廚房後門
  objects.stack = scene.getObjectByName('padStack');
  objects.toilet = scene.getObjectByName('toilet');
  objects.backdoor = scene.getObjectByName('backDoor');
  // 層架上的尿布墊很小，加一個看不見、比較大的點擊範圍
  const stackHit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.6), invisible);
  stackHit.position.y = 0.07;
  objects.stack.add(stackHit);

  /* ----- 目標上方跳動的黃色菱形（同一階段可能有好幾個目標） ----- */
  const pointers = Array.from({ length: 3 }, () => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false }));
    m.scale.y = 1.5;
    m.visible = false;
    m.raycast = () => {};
    scene.add(m);
    return m;
  });
  // 每個目標的菱形位置：物件外框的正上方
  const anchors = {};
  const anchor = id => {
    if (!anchors[id]) {
      const b = new THREE.Box3().setFromObject(objects[id]);
      anchors[id] = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.25, (b.min.z + b.max.z) / 2);
    }
    return anchors[id];
  };

  /* ----- 階段：每個階段有一組目標，全部點完才進到下一個階段 ----- */
  let phases = [], left = new Set(), poopCount = 0;
  const n = () => left.size;
  function buildPhases() {
    const poopIds = poops.filter(p => p.visible).map(p => p.userData.interact);
    poopCount = poopIds.length;
    phases = [
      { step: 0, ids: ['pad0', 'pad1', 'pad2'], hint: () => `撿起用過的尿布墊：走廊一塊、狗房廁所兩塊（還剩 ${n()} 塊）` },
      { step: 1, ids: ['stack'], hint: () => '到狗房廁所拿新尿布墊（東牆毛巾架上方的層架）' },
      { step: 1, ids: ['spot0', 'spot1', 'spot2'], hint: () => `把新尿布墊鋪回原位（還剩 ${n()} 塊）` },
    ];
    if (poopCount) {
      phases.push(
        { step: 2, ids: poopIds, hint: () => `撿起便便（還剩 ${n()} 坨）` },
        { step: 3, ids: ['toilet'], hint: () => '用衛生紙把便便包起來，丟進馬桶沖掉（點馬桶）' });
    }
    phases.push({ step: 4, ids: ['backdoor'],
      hint: () => `${poopCount ? '' : '今天沒有便便！'}到廚房，從後門把舊尿布墊拿出去丟（冰箱左邊的木門）` });
  }
  function enterPhase(i) {
    state.at = i;
    left = new Set(phases[i] ? phases[i].ids : []);
    if (phases[i] && phases[i].ids.includes('spot0')) for (const p of pads) p.ghost.visible = true;
  }

  // 平常的樣子：三塊乾淨的尿布墊鋪著，沒有便便
  function idle() {
    for (const p of pads) { p.pad.visible = true; p.stain.visible = false; p.ghost.visible = false; }
    for (const p of poops) p.visible = false;
  }
  idle();

  function start() {
    state.active = true;
    for (const p of pads) { p.pad.visible = true; p.stain.visible = true; p.ghost.visible = false; }
    // 便便 0～2 坨：三成沒有、四成五一坨、兩成五兩坨
    const r = Math.random(), count = r < 0.3 ? 0 : r < 0.75 ? 1 : 2;
    const order = [...poops].sort(() => Math.random() - 0.5);
    poops.forEach(p => { p.visible = order.indexOf(p) < count; });
    buildPhases();
    enterPhase(0);
    onChange();
  }

  function stop() {
    if (!state.active) return;
    state.active = false;
    idle();
  }

  function finish() {
    Object.assign(state, { active: false, done: true, finished: state.finished + 1 });
    idle();
    localStorage.setItem(DONE_KEY, JSON.stringify({ ...loadDone(), [CLEAN.id]: true }));
  }

  const wants = id => state.active && left.has(id);

  // 玩家點到並走到目標旁邊時呼叫
  function trigger(id) {
    if (!wants(id)) return;
    left.delete(id);
    if (id.startsWith('pad')) objects[id].visible = false;
    if (id.startsWith('spot')) {
      const p = pads[+id.slice(4)];
      p.ghost.visible = false;
      p.pad.visible = true;
      p.stain.visible = false;
    }
    if (id.startsWith('poop')) objects[id].visible = false;
    if (!left.size) {
      if (state.at + 1 < phases.length) enterPhase(state.at + 1);
      else finish();
    }
    onChange();
  }

  function update(time) {
    const ids = state.active ? [...left] : [];
    pointers.forEach((m, i) => {
      m.visible = i < ids.length;
      if (!m.visible) return;
      const a = anchor(ids[i]);
      m.position.set(a.x, a.y + Math.sin(time * 4 + i) * 0.05, a.z);
      m.rotation.y = time * 2;
    });
  }

  let onChange = () => {};
  const api = {
    def: CLEAN, pointers, state, start, stop, trigger, update, wants,
    hint: () => (state.active && phases[state.at] ? phases[state.at].hint() : ''),
    // 清單上每個步驟的文字（今天沒有便便時註明跳過）
    stepTexts: () => CLEAN.steps.map((s, i) =>
      state.active && !poopCount && (i === 2 || i === 3) ? `${s.text}（今天沒有，跳過）` : s.text),
    stepsDone: () => (state.done && !state.active ? CLEAN.steps.length
      : !state.active ? 0 : phases[state.at].step),
    set onChange(f) { onChange = f; },
  };
  return api;
}
