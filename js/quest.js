import * as THREE from 'three';

// 共用的任務骨架：一連串「階段」，每個階段有一組要點的目標（可任意順序），全部點完進下一階段。
// 回傳和其他任務一樣的介面（def、state、start、stop、trigger、update、wants、hint、stepTexts、stepsDone）。
//   def:     { id, title, steps: [{ text }] }
//   phases:  [{ step, ids: [...], hint }]
//   objects: { 目標 id: 3D 物件 }（黃色菱形會出現在物件上方）
//   onStart / onStop / onTrigger(id)：場景物件的變化
const DONE_KEY = 'bafurou-missions-done';
const loadDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch { return {}; } };

export function makeQuest({ scene, def, phases, objects, onStart = () => {}, onStop = () => {}, onTrigger = () => {} }) {
  const state = { active: false, at: 0, done: !!loadDone()[def.id] };
  let left = new Set(), onChange = () => {};

  const pointers = Array.from({ length: Math.max(...phases.map(p => p.ids.length)) }, () => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false }));
    m.scale.y = 1.5;
    m.visible = false;
    m.raycast = () => {};
    scene.add(m);
    return m;
  });
  const anchors = {};
  const anchor = id => {
    if (!anchors[id]) {
      const b = new THREE.Box3().setFromObject(objects[id]);
      anchors[id] = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.22, (b.min.z + b.max.z) / 2);
    }
    return anchors[id];
  };

  const enter = i => { state.at = i; left = new Set(phases[i] ? phases[i].ids : []); };

  function start() {
    state.active = true;
    onStart();
    enter(0);
    onChange();
  }
  function stop() {
    if (!state.active) return;
    state.active = false;
    onStop();
  }
  const wants = id => state.active && left.has(id);
  function trigger(id) {
    if (!wants(id)) return;
    left.delete(id);
    onTrigger(id);
    if (!left.size) {
      if (state.at + 1 < phases.length) enter(state.at + 1);
      else {
        Object.assign(state, { active: false, done: true });
        localStorage.setItem(DONE_KEY, JSON.stringify({ ...loadDone(), [def.id]: true }));
      }
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

  return {
    def, state, start, stop, trigger, update, wants,
    hint: () => (state.active && phases[state.at] ? phases[state.at].hint : ''),
    stepTexts: () => def.steps.map(s => s.text),
    stepsDone: () => (state.done && !state.active ? def.steps.length : !state.active ? 0 : phases[state.at].step),
    set onChange(f) { onChange = f; },
  };
}
