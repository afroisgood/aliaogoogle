import * as THREE from 'three';
import { std, box, cyl, woodTexture } from './kit.js';
import { ROOM } from './livingroom.js';
import { CAT_SPOTS } from './kitchen.js';
import { makeQuest } from './quest.js';

// 支線任務：清理貓砂、餵貓。
const invisible = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
function hitbox(scene, w, h, d, x, y, z, id) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), invisible);
  m.position.set(x, y, z);
  m.userData.interact = id;
  scene.add(m);
  return m;
}

/* ---------- 支線任務一：清理貓砂 ---------- */
// 藍色塑膠袋在松木層架左邊上面那個抽屜；貓砂盆在廚房南牆；挖完從廚房後門拿出去丟。
export function initLitter({ scene }) {
  // 抽屜（livingroom.js 松木層架左單元上層抽屜的正面）：點了會拉出來一下，看得到裡面的藍色袋子
  const HD = ROOM.D / 2, front = -HD + 0.53, cx = -0.52;
  const drawer = new THREE.Group();
  drawer.position.set(cx, 0.84, front);
  box(drawer, 0.8, 0.17, 0.02, std(0xffffff, { map: woodTexture('#d2a565', '#8a5a2a', 4), roughness: 0.6 }), 0, 0, 0.004);
  box(drawer, 0.76, 0.12, 0.3, std(0xcfa569, { roughness: 0.65 }), 0, -0.01, -0.15);       // 抽屜盒
  const bag = box(drawer, 0.3, 0.05, 0.2, std(0x2f6fd0, { roughness: 0.6 }), -0.1, 0.03, -0.12); // 藍色塑膠袋
  box(drawer, 0.12, 0.012, 0.02, std(0x8a5a2a), 0, 0, 0.02);                                     // 把手
  scene.add(drawer);
  const drawerHit = hitbox(scene, 0.82, 0.22, 0.12, cx, 0.84, front + 0.03, 'drawer');
  let drawerOpen = 0;          // 拉出來還要停留幾秒

  // 貓砂盆裡的貓砂塊，開始任務時出現
  const [lx, lz] = CAT_SPOTS.litter;
  const clumps = new THREE.Group();
  for (const [x, z, s] of [[-0.12, 0.05, 1], [0.08, -0.07, 0.8], [0.15, 0.09, 1.2]]) {
    box(clumps, 0.06 * s, 0.03, 0.045 * s, std(0x9a8a70, { roughness: 1 }), x, 0, z).rotation.y = x * 9;
  }
  clumps.position.set(lx, 0.315, lz);
  clumps.visible = false;
  scene.add(clumps);
  const litterHit = hitbox(scene, 0.7, 0.45, 0.5, lx, 0.22, lz, 'litter');

  const quest = makeQuest({
    scene,
    def: { id: 'litter', title: '支線任務一：清理貓砂', steps: [
      { text: '從松木層架左邊的抽屜拿藍色塑膠袋' },
      { text: '到廚房挖貓砂' },
      { text: '從廚房後門把貓砂拿出去丟' },
    ] },
    phases: [
      { step: 0, ids: ['drawer'], hint: '拿藍色塑膠袋（松木層架左邊、上面那個抽屜）' },
      { step: 1, ids: ['litter'], hint: '到廚房挖貓砂（南牆的綠色貓砂盆）' },
      { step: 2, ids: ['backdoor'], hint: '從廚房後門把貓砂拿出去丟（冰箱左邊的木門）' },
    ],
    objects: { drawer: drawerHit, litter: litterHit, backdoor: scene.getObjectByName('backDoor') },
    onStart: () => { clumps.visible = true; bag.visible = true; },
    onStop: () => { clumps.visible = false; bag.visible = true; },
    onTrigger: id => {
      if (id === 'drawer') drawerOpen = 1.2;
      if (id === 'litter') clumps.visible = false;
    },
  });

  // 抽屜拉出來、停一下、袋子被拿走、再推回去
  let last = 0;
  const baseUpdate = quest.update;
  quest.update = time => {
    const dt = Math.min(time - last, 0.05);
    last = time;
    baseUpdate(time);
    if (drawerOpen > 0) {
      drawerOpen -= dt;
      if (drawerOpen < 0.5) bag.visible = false;
      if (drawerOpen <= 0) bag.visible = true;     // 抽屜裡還有別的袋子
    }
    const want = drawerOpen > 0 ? 0.22 : 0;
    drawer.position.z += (front + want - drawer.position.z) * Math.min(1, dt * 10);
  };
  return quest;
}

/* ---------- 支線任務二：餵貓 ---------- */
// 貓飼料桶在廚房東牆靠門口；倒進東牆兩個紫色碗墊上的不鏽鋼碗。
export function initCatFeed({ scene }) {
  const [fx, fz] = CAT_SPOTS.foodBin;
  const binHit = hitbox(scene, 0.4, 0.45, 0.4, fx, 0.2, fz, 'catfood');
  const objects = { catfood: binHit };
  const food = CAT_SPOTS.bowls.map(([x, z], i) => {
    const f = cyl(scene, 0.07, 0.07, 0.02, std(0xa0662e, { roughness: 1 }), x, 0.06, z, 10);
    f.visible = false;
    objects[`catbowl${i}`] = hitbox(scene, 0.38, 0.25, 0.38, x, 0.1, z, `catbowl${i}`);
    return f;
  });

  return makeQuest({
    scene,
    def: { id: 'catfeed', title: '支線任務二：餵貓', steps: [
      { text: '到廚房拿貓飼料' },
      { text: '把飼料倒進兩個紫色碗墊上的鐵碗' },
    ] },
    phases: [
      { step: 0, ids: ['catfood'], hint: '拿貓飼料（廚房東牆、靠門口的米白色飼料桶）' },
      { step: 1, ids: ['catbowl0', 'catbowl1'], hint: '把飼料倒進鐵碗（東牆兩個紫色碗墊上）' },
    ],
    objects,
    onStart: () => { for (const f of food) f.visible = false; },
    onTrigger: id => { if (id.startsWith('catbowl')) food[+id.slice(7)].visible = true; },
  });
}
