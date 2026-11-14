import * as THREE from 'three';
import { std, box, cyl, hitbox, OBSTACLES } from './kit.js';
import { ROOM } from './livingroom.js';
import { findPath, advance, heading, turnAngle } from './nav.js';
import { makeQuest } from './quest.js';
import { play } from './sound.js';

// 任務三：餵狗。
// 狗碗在客廳白色櫃子西側的地上；綠色飼料袋靠在白色櫃子背板旁；凍乾罐在松木層架中間那層右半邊。
// 拿碗 → 裝飼料 → 裝凍乾，碗會放回原位，巴福柔從牠當時所在的地方自己走過去吃，吃完才算完成。
// owns()：巴福柔現在是不是歸這個任務管（走去吃飯、吃飯中），main.js 依這個讓牠不要亂走
const HD = ROOM.D / 2;
const BOWL = [0.25, HD - 0.5];
const EAT_TIME = 4;              // 吃幾秒
const DOG_SPEED = 1.2;
const DOG_R = 0.22;

export function initFeed({ scene, dog }) {
  const world = scene.getObjectByName('world');      // 任務物件放進屋子的群組，跟著一起放大

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
  hitbox(bowl, 0.4, 0.3, 0.4, 0, 0.12, 0);
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
  hitbox(jar, 0.3, 0.3, 0.4, 0, 0.1, 0);
  jar.userData.interact = 'freeze';
  world.add(bowl, bag, jar);
  OBSTACLES.push([BOWL[0] - 0.12, BOWL[0] + 0.12, BOWL[1] - 0.12, BOWL[1] + 0.12]);

  /* ----- 巴福柔走去吃飯 ----- */
  // walk：{ path, eat, retry }，path 是還沒走完的路線點，eat 是已經吃了幾秒；null 表示不歸這個任務管
  let walk = null;
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
    release();
    bowl.visible = true;
    kibble.visible = freeze.visible = false;
    kibble.scale.set(1, 1, 1);
  }
  idle();

  function moveDog(dt) {
    const p = dog.position;
    if (walk.path.length) {                  // 沿著路線走
      advance(p, walk.path, DOG_SPEED * dt, {
        onLeg: (dx, dz, d) => { if (d > 0.01) dog.rotation.y = turnAngle(dog.rotation.y, heading(dx, dz), dt * 8); },
      });
      return;
    }
    if (!atBowl()) {                         // 走不到（被廚房柵欄關在裡面）：在原地等，每秒再試一次
      if ((walk.retry -= dt) <= 0) {
        walk.retry = 1;
        walk.path = plan();
        quest.refresh();
      }
      return;
    }
    // 到碗前面：頭朝碗低下去吃（動作在 pets.js），飼料慢慢變少
    dog.rotation.y = turnAngle(dog.rotation.y, heading(BOWL_AT[0] - p.x, BOWL_AT[1] - p.z), dt * 6);
    dog.userData.eating = true;
    if (Math.floor(walk.eat / 0.32) !== Math.floor((walk.eat + dt) / 0.32)) play('munch');   // 一口一口吃的聲音
    walk.eat += dt;
    const left = Math.max(0.01, 1 - walk.eat / EAT_TIME);
    kibble.scale.set(left, 1, left);
    freeze.visible = walk.eat < EAT_TIME * 0.5;
    if (walk.eat >= EAT_TIME) {
      kibble.visible = false;
      release();
      quest.complete();
    }
  }

  const quest = makeQuest({
    scene,
    def: { id: 'feed', title: '任務三：餵狗', steps: [
      { text: '拿狗碗' },
      { text: '裝飼料到碗裡' },
      { text: '裝凍乾到碗裡' },
      { text: '巴福柔過去吃飯' },
    ] },
    phases: [
      { step: 0, ids: ['bowl'], hint: '拿狗碗（白色櫃子旁邊的地上）' },
      { step: 1, ids: ['kibble'], hint: '裝飼料（白色櫃子後面的綠色飼料袋）' },
      { step: 2, ids: ['freeze'], hint: '裝凍乾（松木層架中間那層，右邊的白色罐子）' },
      { step: 3, ids: [], hint: () => (blocked() ? '巴福柔被廚房柵欄擋住了，去把柵欄打開' : '巴福柔正在吃飯…') },
    ],
    objects: { bowl, kibble: bag, freeze: jar },
    onStart: idle,
    onStop: idle,
    onTrigger: id => {
      if (id === 'bowl') bowl.visible = false;
      if (id === 'kibble') kibble.visible = true;
      if (id === 'freeze') {                 // 碗裝好了：放回原位，巴福柔走過去
        freeze.visible = true;
        bowl.visible = true;
        locate();
        walk = { path: plan(), eat: 0, retry: 0 };
      }
    },
    onUpdate: dt => { if (walk) moveDog(dt); },
  });
  quest.owns = () => !!walk;
  return quest;
}
