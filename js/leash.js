import * as THREE from 'three';
import { findPath, advance, heading, turnAngle } from './nav.js';

// 牽繩：巴福柔沿著人走過的足跡、保持一段距離跟著走（足跡都是走得到的地方，所以不會穿過家具或牆），
// 停下來時臉朝著人；畫一條紅色的繩子從人的手邊拉到牠的脖子。
//   on()：現在有沒有牽著；handY()：人的手大概在多高
// 回傳 update(dt)，每一幀呼叫
const LEASH = 1.5;                        // 超過這個距離牠才跟上來（公尺）

export function initLeash({ scene, dog, fp, on, handY }) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xd8452c }));
  line.frustumCulled = false;
  line.visible = false;
  line.raycast = () => {};
  scene.add(line);

  const trail = [];
  return function update(dt) {
    line.visible = on();
    if (!line.visible) { trail.length = 0; return; }   // 沒牽著：巴福柔自己到處走（wander.js）
    const dp = dog.position;
    if (!trail.length) trail.push(...findPath(dp.x, dp.z, fp.x, fp.z, 0.2));   // 剛繫上：先找一條走到人身邊的路
    const end = trail[trail.length - 1];
    if (!end || Math.hypot(fp.x - end[0], fp.z - end[1]) > 0.1) trail.push([fp.x, fp.z]);
    // 從巴福柔沿著足跡到人的距離
    let len = 0, px = dp.x, pz = dp.z;
    for (const [x, z] of trail) { len += Math.hypot(x - px, z - pz); px = x; pz = z; }
    let moving = false;
    if (len > LEASH) {
      const step = Math.min(len - LEASH, (len > LEASH + 1 ? 4 : 2.2) * dt);
      moving = step > 0.001;
      advance(dp, trail, step, {
        keep: 1,
        onLeg: (dx, dz, d) => { if (d > 0.02) dog.rotation.y = turnAngle(dog.rotation.y, heading(dx, dz), dt * 8); },
      });
    }
    const dx = fp.x - dp.x, dz = fp.z - dp.z;
    if (!moving && Math.hypot(dx, dz) > 0.3) dog.rotation.y = turnAngle(dog.rotation.y, heading(dx, dz), dt * 6);
    // 繩子：從手邊拉到巴福柔的脖子
    const p = line.geometry.attributes.position;
    p.setXYZ(0, fp.x + Math.cos(fp.yaw) * 0.25, handY(), fp.z - Math.sin(fp.yaw) * 0.25);
    p.setXYZ(1, dp.x - Math.sin(dog.rotation.y) * 0.22, 0.66, dp.z - Math.cos(dog.rotation.y) * 0.22);
    p.needsUpdate = true;
  };
}
