import * as THREE from 'three';
import { std, box, cyl, OBSTACLES } from './kit.js';
import { ROOM } from './livingroom.js';
import { findPath } from './nav.js';
import { play } from './sound.js';

// 任務三：餵狗。
// 狗碗在客廳白色櫃子西側的地上；綠色飼料袋靠在白色櫃子背板旁；凍乾罐在松木層架中間那層右半邊。
// 拿碗 → 裝飼料 → 裝凍乾，碗會放回原位，巴福柔從牠當時所在的地方自己走過去吃，吃完繼續到處走。
export const FEED = {
  id: 'feed',
  title: '任務三：餵狗',
  steps: [
    { id: 'bowl', text: '拿狗碗' },
    { id: 'kibble', text: '裝飼料到碗裡' },
    { id: 'freeze', text: '裝凍乾到碗裡' },
    { id: 'eat', text: '巴福柔過去吃飯' },
  ],
};

const TARGETS = [
  { id: 'bowl', hint: '拿狗碗（白色櫃子旁邊的地上）' },
  { id: 'kibble', hint: '裝飼料（白色櫃子後面的綠色飼料袋）' },
  { id: 'freeze', hint: '裝凍乾（松木層架中間那層，右邊的白色罐子）' },
];

const HD = ROOM.D / 2;
const BOWL = [0.25, HD - 0.5];
const EAT_TIME = 4;              // 吃幾秒
const DOG_SPEED = 1.2;

const DONE_KEY = 'bafurou-missions-done';
const loadDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch { return {}; } };

export function initFeed({ scene, dog }) {
  const state = { active: false, at: 0, done: !!loadDone()[FEED.id], finished: 0 };
  const invisible = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  /* ----- 狗碗：飼料與凍乾分開，裝了才看得到 ----- */
  const bowl = new THREE.Group();
  bowl.position.set(BOWL[0], 0, BOWL[1]);
  cyl(bowl, 0.1, 0.085, 0.1, std(0xb98652), 0, 0.05, 0);
  cyl(bowl, 0.085, 0.07, 0.03, std(0xe8e2d4), 0, 0.1, 0);
  const kibble = cyl(bowl, 0.08, 0.08, 0.025, std(0x8a4f22, { roughness: 1 }), 0, 0.11, 0, 10);
  const freeze = new THREE.Group();
  for (const [x, z, r] of [[0.03, 0.02, 0.3], [-0.035, 0.01, 1.1], [0, -0.04, 2], [-0.01, 0.045, 0.7]]) {
    box(freeze, 0.03, 0.02, 0.025, std(0xe6d3a8, { roughness: 1 }), x, 0.13, z).rotation.y = r;
  }
  bowl.add(freeze);
  const bowlHit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), invisible);
  bowlHit.position.y = 0.12;
  bowl.add(bowlHit);
  bowl.userData.interact = 'bowl';

  /* ----- 綠色飼料袋：靠在白色櫃子背板（西側）旁 ----- */
  const bag = new THREE.Group();
  bag.position.set(0.66, 0, 1.62);
  box(bag, 0.14, 0.42, 0.3, std(0x6f9f66, { roughness: 0.9 }), 0, 0.21, 0);
  box(bag, 0.145, 0.06, 0.31, std(0x557c4e, { roughness: 0.9 }), 0, 0.4, 0);
  bag.userData.interact = 'kibble';
  OBSTACLES.push([0.58, 0.74, 1.46, 1.78]);

  /* ----- 凍乾罐：松木層架中間那層右半邊 ----- */
  const jar = new THREE.Group();
  jar.position.set(0.55, 1.03, -HD + 0.28);
  cyl(jar, 0.06, 0.06, 0.12, std(0xf5f5f5), 0, 0.06, 0);
  cyl(jar, 0.062, 0.062, 0.02, std(0xe0e0dc), 0, 0.125, 0);
  const jarHit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.4), invisible);
  jarHit.position.y = 0.1;
  jar.add(jarHit);
  jar.userData.interact = 'freeze';
  scene.getObjectByName('world').add(bowl, bag, jar);      // 跟著屋子一起放大
  OBSTACLES.push([BOWL[0] - 0.12, BOWL[0] + 0.12, BOWL[1] - 0.12, BOWL[1] + 0.12]);

  const objects = { bowl, kibble: bag, freeze: jar };

  const pointer = new THREE.Mesh(new THREE.OctahedronGeometry(0.11),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false }));
  pointer.scale.y = 1.5;
  pointer.visible = false;
  pointer.raycast = () => {};
  scene.add(pointer);
  const anchors = {};
  const anchor = id => {
    if (!anchors[id]) {
      const b = new THREE.Box3().setFromObject(objects[id]);
      anchors[id] = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 0.2, (b.min.z + b.max.z) / 2);
    }
    return anchors[id];
  };

  /* ----- 巴福柔走去吃飯：null 表示不歸這個任務管 ----- */
  // { path, eat, retry }：path 是還沒走完的路線點，eat 是已經吃了幾秒
  let walk = null;
  const owns = () => !!walk;
  const DOG_R = 0.22;
  // 碗的實際位置（屋子換算成實際大小之後才知道），以及巴福柔吃飯時站的位置（頭朝東對著碗）
  const BOWL_AT = [0, 0], EAT_SPOT = [0, 0];
  const locate = () => {
    const at = bowl.getWorldPosition(new THREE.Vector3());
    BOWL_AT[0] = at.x; BOWL_AT[1] = at.z;
    EAT_SPOT[0] = at.x - 0.55; EAT_SPOT[1] = at.z;
  };
  const atBowl = () => Math.hypot(dog.position.x - EAT_SPOT[0], dog.position.z - EAT_SPOT[1]) < 0.15;
  const blocked = () => !!walk && !walk.path.length && !atBowl() && walk.eat === 0;
  const plan = () => findPath(dog.position.x, dog.position.z, EAT_SPOT[0], EAT_SPOT[1], DOG_R);

  function release() {
    walk = null;
    dog.userData.eating = false;
  }

  function idle() {
    bowl.visible = true;
    kibble.visible = freeze.visible = false;
    kibble.scale.set(1, 1, 1);
  }
  idle();

  const target = () => (state.active && state.at < TARGETS.length ? TARGETS[state.at] : null);

  function start() {
    if (walk) release();
    Object.assign(state, { active: true, at: 0 });
    idle();
    onChange();
  }

  function stop() {
    if (walk) release();
    if (!state.active) return;
    state.active = false;
    idle();
  }

  function finish() {
    Object.assign(state, { active: false, done: true, finished: state.finished + 1 });
    localStorage.setItem(DONE_KEY, JSON.stringify({ ...loadDone(), [FEED.id]: true }));
    onChange();
  }

  function trigger(id) {
    const t = target();
    if (!t || t.id !== id) return;
    if (id === 'bowl') bowl.visible = false;
    if (id === 'kibble') kibble.visible = true;
    if (id === 'freeze') {
      // 碗裝好了：放回原位，巴福柔走過去
      freeze.visible = true;
      bowl.visible = true;
      locate();
      walk = { path: plan(), eat: 0, retry: 0 };
    }
    state.at++;
    onChange();
  }

  let last = 0;
  function update(time) {
    const dt = Math.min(time - last, 0.05);
    last = time;
    const t = target();
    pointer.visible = !!t;
    if (t) {
      const a = anchor(t.id);
      pointer.position.set(a.x, a.y + Math.sin(time * 4) * 0.05, a.z);
      pointer.rotation.y = time * 2;
    }
    if (walk) moveDog(dt, time);
  }

  function moveDog(dt, time) {
    const p = dog.position;
    if (walk.path.length) {                  // 沿著路線走
      let step = DOG_SPEED * dt;
      while (walk.path.length && step > 0) {
        const [tx, tz] = walk.path[0], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d > 0.01) {
          const want = Math.atan2(-dx, -dz);
          dog.rotation.y += Math.atan2(Math.sin(want - dog.rotation.y), Math.cos(want - dog.rotation.y)) * Math.min(1, dt * 8);
        }
        if (d <= step) { p.x = tx; p.z = tz; step -= d; walk.path.shift(); }
        else { p.x += dx / d * step; p.z += dz / d * step; step = 0; }
      }
      return;
    }
    if (!atBowl()) {                         // 走不到（被廚房柵欄關在裡面）：在原地等，每秒再試一次
      if ((walk.retry -= dt) <= 0) {
        walk.retry = 1;
        walk.path = plan();
        onChange();
      }
      return;
    }
    // 到碗前面：頭朝碗低下去吃，飼料慢慢變少
    const want = Math.atan2(-(BOWL_AT[0] - p.x), -(BOWL_AT[1] - p.z));
    dog.rotation.y += Math.atan2(Math.sin(want - dog.rotation.y), Math.cos(want - dog.rotation.y)) * Math.min(1, dt * 6);
    dog.userData.eating = true;             // 低頭吃的動作在 pets.js
    if (Math.floor(walk.eat / 0.32) !== Math.floor((walk.eat + dt) / 0.32)) play('munch');   // 一口一口吃的聲音
    walk.eat += dt;
    const left = Math.max(0, 1 - walk.eat / EAT_TIME);
    kibble.scale.set(Math.max(left, 0.01), 1, Math.max(left, 0.01));
    freeze.visible = walk.eat < EAT_TIME * 0.5;
    if (walk.eat >= EAT_TIME) {
      kibble.visible = false;
      release();
      finish();
    }
  }

  let onChange = () => {};
  return {
    def: FEED, pointers: [pointer], state, start, stop, trigger, update, owns,
    wants: id => !!target() && target().id === id,
    hint: () => (target() ? target().hint
      : !state.active ? ''
      : blocked() ? '巴福柔被廚房柵欄擋住了，去把柵欄打開'
      : '巴福柔正在吃飯…'),
    stepTexts: () => FEED.steps.map(s => s.text),
    stepsDone: () => (state.done && !state.active ? FEED.steps.length : !state.active ? 0 : state.at),
    set onChange(f) { onChange = f; },
  };
}
