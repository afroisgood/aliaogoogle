import * as THREE from 'three';
import { boundsOf } from './layout.js';

// 所有任務共用的骨架：一連串「階段」，每個階段有一組要點的目標（可任意順序），全部點完進下一階段，
// 最後一個階段點完就完成。目標上方會有跳動的黃色菱形。
//
//   def:       { id, title, steps: [{ text }] }（任務清單上的步驟）
//   phases:    [{ step, ids: [...], hint }]，或在開始任務時才決定的 () => [...]
//              step：這個階段屬於清單上的第幾個步驟；hint：畫面上方的目標文字（字串或函式）
//              ids 是空的階段不用點東西，等程式呼叫 complete() 才算完成（例如出門散步、狗在吃飯）
//   objects:   { 目標 id: 3D 物件 }
//   tops:      { 目標 id: 高度 }：菱形每一幀跟著物件的位置、放在物件原點上方這個高度（會動的物件用）；
//              沒寫的放在物件外框正上方
//   stepTexts: 自訂清單上的步驟文字（預設用 def.steps）
//   onStart / onStop / onComplete / onEnter(階段) / onTrigger(id) / onUpdate(dt, time)：場景物件的變化
//
// 回傳的介面：def、state、pointers、start、stop、trigger、update、wants、hint、stepTexts、stepsDone、
// complete、remaining（這個階段還剩幾個目標）、refresh（目標文字變了，請畫面更新）、onChange（setter）
const DONE_KEY = 'bafurou-missions-done';
const loadDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch { return {}; } };
const markDone = id => localStorage.setItem(DONE_KEY, JSON.stringify({ ...loadDone(), [id]: true }));

const pointerMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false });
const pointerGeo = new THREE.OctahedronGeometry(0.11);

export function makeQuest({
  scene, def, phases: plan, objects, tops = {}, stepTexts,
  onStart = () => {}, onStop = () => {}, onComplete = () => {}, onEnter = () => {}, onTrigger = () => {}, onUpdate = () => {},
}) {
  const state = { active: false, at: 0, done: !!loadDone()[def.id], finished: 0 };
  let phases = typeof plan === 'function' ? [] : plan, left = new Set(), onChange = () => {};

  /* ----- 黃色菱形：同一階段有幾個目標就用幾個，不夠再做 ----- */
  const pointers = [];
  const pointer = i => {
    if (!pointers[i]) {
      const m = new THREE.Mesh(pointerGeo, pointerMat);
      m.scale.y = 1.5;
      m.visible = false;
      m.raycast = () => {};          // 菱形本身不擋點擊
      scene.add(m);
      pointers[i] = m;
    }
    return pointers[i];
  };
  const anchors = {};
  function anchor(id) {
    const o = objects[id];
    if (id in tops) {
      const a = anchors[id] || (anchors[id] = new THREE.Vector3());
      o.getWorldPosition(a);
      a.y += tops[id];
      return a;
    }
    if (!anchors[id]) {          // 第一次用到才量（屋子已經換算成實際大小）；只有點擊範圍的物件就量點擊範圍
      let b = boundsOf(o);
      if (b.isEmpty()) b = new THREE.Box3().setFromObject(o);
      anchors[id] = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.22, (b.min.z + b.max.z) / 2);
    }
    return anchors[id];
  }

  /* ----- 流程 ----- */
  const phase = () => (state.active ? phases[state.at] : null);
  function enter(i) {
    state.at = i;
    left = new Set(phases[i].ids);
    onEnter(phases[i]);
  }

  function start() {
    state.active = true;
    onStart();
    if (typeof plan === 'function') phases = plan();
    enter(0);
    onChange();
  }
  function stop() {
    if (!state.active) return;
    state.active = false;
    onStop();
  }
  function complete() {
    if (!state.active) return;
    Object.assign(state, { active: false, done: true, finished: state.finished + 1 });
    markDone(def.id);
    onComplete();
    onChange();
  }

  const wants = id => state.active && left.has(id);
  function trigger(id) {
    if (!wants(id)) return;
    left.delete(id);
    onTrigger(id);
    if (!state.active) return;           // onTrigger 裡已經結束任務
    if (!left.size && phases[state.at].ids.length) {
      if (state.at + 1 < phases.length) enter(state.at + 1);
      else return complete();
    }
    onChange();
  }

  let last = 0;
  function update(time) {
    const dt = Math.min(time - last, 0.05);
    last = time;
    onUpdate(dt, time);
    const ids = state.active ? [...left] : [];
    for (let i = 0; i < Math.max(ids.length, pointers.length); i++) {
      const m = pointer(i);
      m.visible = i < ids.length;
      if (!m.visible) continue;
      const a = anchor(ids[i]);
      m.position.set(a.x, a.y + Math.sin(time * 4 + i) * 0.05, a.z);
      m.rotation.y = time * 2;
    }
  }

  return {
    def, state, pointers, start, stop, trigger, update, wants, complete,
    remaining: () => left.size,
    hint: () => { const p = phase(); return !p ? '' : typeof p.hint === 'function' ? p.hint() : p.hint || ''; },
    stepTexts: stepTexts || (() => def.steps.map(s => s.text)),
    stepsDone: () => (state.done && !state.active ? def.steps.length : !state.active ? 0 : phases[state.at].step),
    refresh: () => onChange(),
    set onChange(f) { onChange = f; },
  };
}
