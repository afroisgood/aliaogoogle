import * as THREE from 'three';
import { std, box, cyl } from './kit.js';
import { ROOM } from './livingroom.js';
import { openWalk } from './walk.js';

// 任務一：帶狗出門。屋內依序完成三件事，出門後進入散步路線頁。
// 牽繩與狗狗包的擺放位置目前是暫定的（松木層架），之後要依實際位置調整。
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
  { id: 'leash', step: 0, hint: '拿牽繩（掛在松木層架右側）' },
  { id: 'dog', step: 0, hint: '走到巴福柔旁邊，點牠繫上牽繩' },
  { id: 'bag', step: 1, hint: '拿狗狗包（在松木層架的層板上）' },
  { id: 'door', step: 2, hint: '從大門出門（最右邊那片落地門）' },
];

const DONE_KEY = 'bafurou-missions-done';
const loadDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch { return {}; } };

export function initMission({ scene, dog, onChange }) {
  const HD = ROOM.D / 2;
  const state = { active: false, at: 0, leashed: false, done: !!loadDone()[MISSION.id] };

  /* ----- 屋內的任務物件 ----- */
  const leash = new THREE.Group();                        // 牽繩：掛在層架右側
  leash.position.set(0.86, 1.32, -HD + 0.3);
  const rope = std(0xd8452c, { roughness: 0.9 });
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.014, 6, 14), rope);
  loop.rotation.y = Math.PI / 2;
  leash.add(loop);
  box(leash, 0.02, 0.5, 0.03, rope, 0, -0.32, 0.03);
  box(leash, 0.03, 0.07, 0.04, std(0xb9b2a0, { metalness: 0.8, roughness: 0.3 }), 0, -0.6, 0.03);
  leash.userData.interact = 'leash';

  const bag = new THREE.Group();                          // 狗狗包：層架的開放層板上
  bag.position.set(0.02, 1.03, -HD + 0.33);
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
  scene.add(leash, bag, door);

  // 目標上方跳動的黃色菱形
  const pointer = new THREE.Mesh(new THREE.OctahedronGeometry(0.11),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false }));
  pointer.scale.y = 1.5;
  pointer.visible = false;
  scene.add(pointer);
  const objects = { leash, dog, bag, door };
  const tops = { leash: 0.3, dog: 1.0, bag: 0.5, door: 0.35 };

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
