import * as THREE from 'three';
import { std, box, cyl } from './kit.js';
import { ROOM } from './livingroom.js';
import { openWalk } from './walk.js';

// 任務一：帶狗出門。屋內依序完成三件事，出門後進入散步路線頁。
// 牽繩與狗狗包都放在松木層架中間那層開放層板上：牽繩在左半邊，狗狗包在右半邊。
export const MISSION = {
  id: 'walk',
  title: '任務一：帶狗出門',
  steps: [
    { id: 'leash', text: '用牽繩繫好巴福柔' },
    { id: 'bag', text: '拿狗狗包' },
    { id: 'door', text: '從大門出門' },
    { id: 'route', text: '照路線散步後回家' },
  ],
};

// 每個要點擊的目標：提示文字，以及完成後推進到哪一個步驟
const TARGETS = [
  { id: 'leash', step: 0, hint: '拿牽繩（松木層架中間那層，左半邊）' },
  { id: 'dog', step: 0, hint: '走到巴福柔旁邊，點牠繫上牽繩' },
  { id: 'bag', step: 1, hint: '拿狗狗包（松木層架中間那層，右半邊）' },
  { id: 'door', step: 2, hint: '從大門出門（最右邊那片落地門）' },
];

const DONE_KEY = 'bafurou-missions-done';
const loadDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch { return {}; } };

export function initMission({ scene, dog, onChange }) {
  const HD = ROOM.D / 2;
  const state = { active: false, at: 0, leashed: false, done: !!loadDone()[MISSION.id] };

  /* ----- 屋內的任務物件 ----- */
  const leash = new THREE.Group();                        // 牽繩：捲起來放在層架左半邊的層板上
  leash.position.set(-0.45, 1.03, -HD + 0.33);
  const rope = std(0xd8452c, { roughness: 0.9 });
  for (const [r, y] of [[0.1, 0.02], [0.085, 0.045]]) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 6, 14), rope);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = y;
    leash.add(coil);
  }
  box(leash, 0.035, 0.03, 0.08, std(0xb9b2a0, { metalness: 0.8, roughness: 0.3 }), 0.12, 0.02, 0.06);
  leash.userData.interact = 'leash';

  const bag = new THREE.Group();                          // 狗狗包：層架右半邊的層板上
  bag.position.set(0.3, 1.03, -HD + 0.33);
  const canvasMat = std(0xd9a321, { roughness: 0.9 });
  box(bag, 0.3, 0.22, 0.14, canvasMat, 0, 0.11, 0);
  box(bag, 0.31, 0.06, 0.15, std(0x8a6414, { roughness: 0.9 }), 0, 0.2, 0);
  box(bag, 0.03, 0.02, 0.02, std(0x2a2a2a), 0, 0.2, 0.08);
  bag.userData.interact = 'bag';

  const door = new THREE.Mesh(                            // 大門的點擊範圍（看不見）
    new THREE.BoxGeometry(1.0, 2.05, 0.2),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  door.position.set(1.7, 1.03, HD - 0.08);
  door.userData.interact = 'door';
  dog.userData.interact = 'dog';
  // 小東西不好點，各加一個看不見、比較大的點擊範圍
  for (const [o, y] of [[leash, 0.12], [bag, 0.14]]) {
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), door.material);
    hitbox.position.y = y;
    o.add(hitbox);
  }
  scene.add(leash, bag, door);

  // 目標上方跳動的黃色菱形
  const pointer = new THREE.Mesh(new THREE.OctahedronGeometry(0.11),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false }));
  pointer.scale.y = 1.5;
  pointer.visible = false;
  pointer.raycast = () => {};          // 菱形本身不擋點擊
  scene.add(pointer);
  const objects = { leash, dog, bag, door };
  const tops = { leash: 0.28, dog: 1.0, bag: 0.42, door: 0.35 };

  const target = () => (state.active ? TARGETS[state.at] : null);

  function start() {
    Object.assign(state, { active: true, at: 0, leashed: false });
    leash.visible = bag.visible = true;
    onChange();
  }

  function finish() {
    Object.assign(state, { active: false, leashed: false, done: true });
    leash.visible = bag.visible = true;
    localStorage.setItem(DONE_KEY, JSON.stringify({ ...loadDone(), [MISSION.id]: true }));
    onChange();
  }

  // 玩家點到並走到目標旁邊時呼叫
  function trigger(id) {
    const t = target();
    if (!t || t.id !== id) return;
    if (id === 'leash') leash.visible = false;
    if (id === 'dog') state.leashed = true;
    if (id === 'bag') bag.visible = false;
    state.at++;
    if (id === 'door') { state.at = TARGETS.length; openWalk(finish); }
    onChange();
  }

  function update(time) {
    const t = target();
    pointer.visible = !!t;
    if (!t) return;
    const o = objects[t.id];
    pointer.position.set(o.position.x, o.position.y + tops[t.id] + Math.sin(time * 4) * 0.05, o.position.z);
    pointer.rotation.y = time * 2;
  }

  return {
    state, start, trigger, update,
    wants: id => !!target() && target().id === id,
    hint: () => (target() ? target().hint : ''),
    // 目前做到第幾個步驟（供清單打勾）
    stepsDone: () => (state.done && !state.active ? MISSION.steps.length
      : !state.active ? 0 : state.at >= TARGETS.length ? 3 : TARGETS[state.at].step),
  };
}
