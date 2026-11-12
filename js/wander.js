import { walkable, findPath, randomSpot } from './nav.js';

// 寵物在整個屋子裡隨機走動：發呆幾秒 → 隨機挑一個走得到的地方 → 找路走過去 → 再發呆。
// 每隻寵物：{ obj, r（身體半寬）, front（位置點到鼻子的距離）, speed, rest: [最短, 最長] 秒,
//            free()：現在能不能自己亂走 }
// player()：人現在的位置 { x, z, r }，沒有人在屋裡走（俯瞰）時回傳 null
//
// 不穿模的做法：
// - 找路時身體兩側留 r 的距離，不會擦過牆和家具
// - 走路時先看鼻子前方是不是走得到，碰到東西就停在那裡，不把頭伸進牆裡
// - 和其他寵物、和人保持距離，被擋住就等一下，等太久就換個地方去
export function initWander(pets, player) {
  for (const p of pets) Object.assign(p, { path: null, wait: 1 + Math.random() * 3, stuck: 0 });

  function turn(o, dx, dz, dt) {
    const want = Math.atan2(-dx, -dz);
    o.rotation.y += Math.atan2(Math.sin(want - o.rotation.y), Math.cos(want - o.rotation.y)) * Math.min(1, dt * 8);
  }

  // (x, z) 這個位置會不會撞到別的寵物或人
  function crowded(p, x, z) {
    const others = pets.filter(q => q !== p && q.obj.visible !== false)
      .map(q => ({ x: q.obj.position.x, z: q.obj.position.z, r: q.r + q.front * 0.5 }));
    const me = player();
    if (me) others.push(me);
    const mine = p.r + p.front * 0.5;
    const now = p.obj.position;
    // 只擋「越走越近」的情況，已經靠在一起時往外走不會被卡住
    return others.some(o => {
      const d = Math.hypot(x - o.x, z - o.z);
      return d < mine + o.r && d < Math.hypot(now.x - o.x, now.z - o.z);
    });
  }

  const rest = p => p.rest[0] + Math.random() * (p.rest[1] - p.rest[0]);

  function update(dt, time) {
    for (const p of pets) {
      const o = p.obj;
      if (!p.free()) { p.path = null; p.wait = 1 + Math.random() * 2; continue; }
      if (!p.path) {
        o.position.y = 0;
        if ((p.wait -= dt) > 0) continue;
        const to = randomSpot(p.r);
        p.path = to ? findPath(o.position.x, o.position.z, to[0], to[1], p.r) : [];
        p.stuck = 0;
        if (!p.path.length) { p.path = null; p.wait = 1; }
        continue;
      }
      // 這一步要走到哪
      let step = p.speed * dt, nx = o.position.x, nz = o.position.z;
      const path = [...p.path];
      while (path.length && step > 0) {
        const [tx, tz] = path[0], dx = tx - nx, dz = tz - nz, d = Math.hypot(dx, dz);
        if (d <= step) { nx = tx; nz = tz; step -= d; path.shift(); }
        else { nx += dx / d * step; nz += dz / d * step; step = 0; }
      }
      const mx = nx - o.position.x, mz = nz - o.position.z, m = Math.hypot(mx, mz);
      // 鼻子前方碰到牆或家具：停在這裡
      const nose = m > 1e-4 && !walkable(nx + mx / m * p.front, nz + mz / m * p.front, 0.03);
      if (nose && p.path.length < 6) { p.path = null; p.wait = rest(p); o.position.y = 0; continue; }
      if (crowded(p, nx, nz)) {               // 被別的寵物或人擋住
        o.position.y = 0;
        if ((p.stuck += dt) > 1.5) { p.path = null; p.wait = 0.3; }
        continue;
      }
      p.stuck = 0;
      o.position.x = nx; o.position.z = nz;
      p.path = path;
      // 看前面幾格的方向轉身，轉彎才不會一格一格抖
      const [lx, lz] = p.path[Math.min(3, p.path.length - 1)] || [nx, nz];
      if (Math.hypot(lx - nx, lz - nz) > 0.02) turn(o, lx - nx, lz - nz, dt);
      o.position.y = Math.abs(Math.sin(time * p.speed * 12)) * 0.015;      // 走路的小跳動
      if (!p.path.length) { p.path = null; p.wait = rest(p); }
    }
  }

  // 柵欄開關之後，正在走的路線可能穿過柵欄，全部重新找
  const replan = () => { for (const p of pets) if (p.path) { p.path = null; p.wait = 0; } };

  return { update, replan };
}
