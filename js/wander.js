import { findPath, randomSpot } from './nav.js';

// 寵物在整個屋子裡隨機走動：發呆幾秒 → 隨機挑一個走得到的地方 → 找路走過去 → 再發呆。
// 每隻寵物：{ obj, r（身體半徑）, speed, rest: [最短, 最長] 秒, free()：現在能不能自己亂走 }
export function initWander(pets) {
  for (const p of pets) Object.assign(p, { path: null, wait: 1 + Math.random() * 3 });

  function face(p, dx, dz, dt) {
    const want = Math.atan2(-dx, -dz), o = p.obj;
    o.rotation.y += Math.atan2(Math.sin(want - o.rotation.y), Math.cos(want - o.rotation.y)) * Math.min(1, dt * 8);
  }

  function update(dt, time) {
    for (const p of pets) {
      const o = p.obj;
      if (!p.free()) { p.path = null; p.wait = 1 + Math.random() * 2; continue; }
      if (!p.path) {
        o.position.y = 0;
        if ((p.wait -= dt) > 0) continue;
        const to = randomSpot(p.r);
        p.path = to ? findPath(o.position.x, o.position.z, to[0], to[1], p.r) : [];
        if (!p.path.length) { p.path = null; p.wait = 1; }
        continue;
      }
      let step = p.speed * dt;
      while (p.path.length && step > 0) {
        const [tx, tz] = p.path[0], dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz);
        if (d <= step) { o.position.x = tx; o.position.z = tz; step -= d; p.path.shift(); }
        else { o.position.x += dx / d * step; o.position.z += dz / d * step; step = 0; }
      }
      // 看前面幾格的方向轉身，轉彎才不會一格一格抖
      const [lx, lz] = p.path[Math.min(3, p.path.length - 1)] || [o.position.x, o.position.z];
      if (Math.hypot(lx - o.position.x, lz - o.position.z) > 0.02) face(p, lx - o.position.x, lz - o.position.z, dt);
      o.position.y = Math.abs(Math.sin(time * p.speed * 12)) * 0.015;      // 走路的小跳動
      if (!p.path.length) {
        p.path = null;
        p.wait = p.rest[0] + Math.random() * (p.rest[1] - p.rest[0]);
      }
    }
  }

  // 柵欄開關之後，正在走的路線可能穿過柵欄，全部重新找
  const replan = () => { for (const p of pets) if (p.path) { p.path = null; p.wait = 0; } };

  return { update, replan };
}
