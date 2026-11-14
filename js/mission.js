import * as THREE from 'three';
import { std, box, hitbox } from './kit.js';
import { ROOM } from './livingroom.js';
import { openWalk } from './walk.js';
import { makeQuest } from './quest.js';

// 任務一：帶狗出門。屋內依序完成三件事，出門後進入散步路線頁，走完回家才算完成。
// 牽繩與狗狗包都放在松木層架中間那層開放層板上：牽繩在左半邊，狗狗包在右半邊。
// state.leashed：巴福柔是不是被牽著（main.js 依這個讓牠跟著人走）
export function initMission({ scene, dog }) {
  const HD = ROOM.D / 2;
  const world = scene.getObjectByName('world');      // 任務物件放進屋子的群組，跟著一起放大

  const leash = new THREE.Group();                    // 牽繩：捲起來放在層架左半邊的層板上
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

  const bag = new THREE.Group();                      // 狗狗包：層架右半邊的層板上
  bag.position.set(0.3, 1.03, -HD + 0.33);
  box(bag, 0.3, 0.22, 0.14, std(0xd9a321, { roughness: 0.9 }), 0, 0.11, 0);
  box(bag, 0.31, 0.06, 0.15, std(0x8a6414, { roughness: 0.9 }), 0, 0.2, 0);
  box(bag, 0.03, 0.02, 0.02, std(0x2a2a2a), 0, 0.2, 0.08);
  bag.userData.interact = 'bag';

  // 小東西不好點，各加一個比較大的點擊範圍
  hitbox(leash, 0.42, 0.34, 0.42, 0, 0.12, 0);
  hitbox(bag, 0.42, 0.34, 0.42, 0, 0.14, 0);
  world.add(leash, bag);
  const door = hitbox(world, 1.0, 2.05, 0.2, 1.7, 1.03, HD - 0.08, 'door');   // 大門（最右邊那片落地門）
  dog.userData.interact = 'dog';

  const reset = () => {
    quest.state.leashed = false;
    leash.visible = bag.visible = true;
  };
  const quest = makeQuest({
    scene,
    def: { id: 'walk', title: '任務一：帶狗出門', steps: [
      { text: '用牽繩繫好巴福柔' },
      { text: '拿狗狗包' },
      { text: '從大門出門' },
      { text: '照路線散步後回家' },
    ] },
    phases: [
      { step: 0, ids: ['leash'], hint: '拿牽繩（松木層架中間那層，左半邊）' },
      { step: 0, ids: ['dog'], hint: '走到巴福柔旁邊，點牠繫上牽繩' },
      { step: 1, ids: ['bag'], hint: '拿狗狗包（松木層架中間那層，右半邊）' },
      { step: 2, ids: ['door'], hint: '從大門出門（最右邊那片落地門）' },
      { step: 3, ids: [] },                             // 散步路線頁，按「到家了」才完成
    ],
    objects: { leash, dog, bag, door },
    tops: { leash: 0.28, dog: 1.0, bag: 0.42, door: 0.35 },
    onStart: reset,
    onStop: reset,
    onComplete: reset,
    onTrigger: id => {
      if (id === 'leash') leash.visible = false;
      if (id === 'dog') quest.state.leashed = true;
      if (id === 'bag') bag.visible = false;
      if (id === 'door') openWalk(() => quest.complete());
    },
  });
  quest.state.leashed = false;
  return quest;
}
