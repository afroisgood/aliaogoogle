import { walkable, findPath, randomSpot } from './nav.js';

// 寵物在整個屋子裡隨機走動：發呆幾秒 → 隨機挑一個走得到的地方 → 找路走過去 → 再發呆。
// 每隻寵物：{ obj, r（身體半寬）, front（位置點到鼻子的距離）, speed, rest: [最短, 最長] 秒,
//            turn（每秒最多轉幾弧度，預設 3）, free()：現在能不能自己亂走 }
// player()：人現在的位置 { x, z, r }，沒有人在屋裡走（俯瞰）時回傳 null
//
// 不穿模的做法：
// - 找路時身體兩側留 r 的距離，不會擦過牆和家具
// - 走路時先看鼻子前方是不是走得到，碰到東西就停在那裡，不把頭伸進牆裡
// - 和其他寵物、和人保持距離，被擋住就等一下，等太久就換個地方去
export function initWander(pets, player) {
  for (const p of pets) Object.assign(p, { path: null, wait: 1 + Math.random() * 3, stuck: 0, v: 0, turn: p.turn || 3 });

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
      if (!p.free()) { p.path = null; p.v = 0; p.wait = 1 + Math.random() * 2; continue; }
      if (!p.path) {
        if ((p.wait -= dt) > 0) continue;
        const to = randomSpot(p.r);
        p.path = to ? findPath(o.position.x, o.position.z, to[0], to[1], p.r) : [];
        p.stuck = 0;
        if (!p.path.length) { p.path = null; p.wait = 1; }
        continue;
      }
      // 先轉向要去的方向：差太多就原地轉身，轉得差不多了才起步（真的動物不會橫著走）
      const [lx, lz] = p.path[Math.min(3, p.path.length - 1)];
      const hx = lx - o.position.x, hz = lz - o.position.z;
      let off = 0;
      if (Math.hypot(hx, hz) > 0.02) {
        const want = Math.atan2(-hx, -hz);
        off = Math.atan2(Math.sin(want - o.rotation.y), Math.cos(want - o.rotation.y));
        o.rotation.y += Math.sign(off) * Math.min(Math.abs(off), p.turn * dt);
      }
      // 起步、停下都是慢慢加速減速；快到終點、或還在轉彎時放慢
      const slow = Math.abs(off) > 1 ? 0 : Math.abs(off) > 0.4 ? 0.5 : 1;
      const target = p.speed * slow * (p.path.length < 4 ? 0.5 : 1);
      p.v += Math.sign(target - p.v) * Math.min(Math.abs(target - p.v), p.speed * 2.5 * dt);
      // 這一步要走到哪
      let step = p.v * dt, nx = o.position.x, nz = o.position.z;
      const path = [...p.path];
      while (path.length && step > 0) {
        const [tx, tz] = path[0], dx = tx - nx, dz = tz - nz, d = Math.hypot(dx, dz);
        if (d <= step) { nx = tx; nz = tz; step -= d; path.shift(); }
        else { nx += dx / d * step; nz += dz / d * step; step = 0; }
      }
      const mx = nx - o.position.x, mz = nz - o.position.z, m = Math.hypot(mx, mz);
      // 鼻子前方碰到牆或家具：停在這裡
      const nose = m > 1e-4 && !walkable(nx + mx / m * p.front, nz + mz / m * p.front, 0.03);
      if (nose && p.path.length < 6) { p.path = null; p.v = 0; p.wait = rest(p); continue; }
      if (crowded(p, nx, nz)) {               // 被別的寵物或人擋住
        p.v = 0;
        if ((p.stuck += dt) > 1.5) { p.path = null; p.wait = 0.3; }
        continue;
      }
      p.stuck = 0;
      o.position.x = nx; o.position.z = nz;
      p.path = path;
      if (!p.path.length) { p.path = null; p.v = 0; p.wait = rest(p); }
    }
  }

  // 柵欄開關之後，正在走的路線可能穿過柵欄，全部重新找
  const replan = () => { for (const p of pets) if (p.path) { p.path = null; p.wait = 0; } };

  return { update, replan };
}
