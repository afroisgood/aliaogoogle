import { OBSTACLES, WALK, ROOMS } from './kit.js';

// 走路用的共用工具：人、巴福柔、貓都用同一套可走範圍與找路、沿路走、轉身。
// 角度一律是 rotation.y 的定義：0 朝 -z（北），正值往西轉。

// (x, z) 在哪個房間（不在任何房間裡回傳空字串）
export function roomAt(x, z) {
  const hit = ROOMS.find(({ rect: [x1, x2, z1, z2] }) => x >= x1 && x <= x2 && z >= z1 && z <= z2);
  return hit ? hit.name : '';
}

// 往 (dx, dz) 這個方向時的角度
export const heading = (dx, dz) => Math.atan2(-dx, -dz);
// 從角度 a 轉到 b 最近要轉多少（-π～π）
export const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// 從 from 往 to 轉過去一部分（k：這一幀轉過去的比例，超過 1 當 1）
export const turnAngle = (from, to, k) => from + angleDiff(from, to) * Math.min(1, k);

// 沿著路線點往前走 step 公尺：直接改 pos 的 x、z，走過的點從 path 移除，回傳沒用完的距離。
//   keep：最後留幾個點不走（牽繩跟在後面時用）
//   onLeg(dx, dz, d)：每一段開始走之前呼叫，可以用來轉向
export function advance(pos, path, step, { keep = 0, onLeg } = {}) {
  while (path.length > keep && step > 0) {
    const [tx, tz] = path[0], dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
    if (onLeg) onLeg(dx, dz, d);
    if (d <= step) { pos.x = tx; pos.z = tz; step -= d; path.shift(); }
    else { pos.x += dx / d * step; pos.z += dz / d * step; step = 0; }
  }
  return step;
}

export function walkable(x, z, r) {
  if (!WALK.some(([x1, x2, z1, z2]) => x >= x1 + r && x <= x2 - r && z >= z1 + r && z <= z2 - r)) return false;
  return !OBSTACLES.some(([x1, x2, z1, z2]) => x > x1 - r && x < x2 + r && z > z1 - r && z < z2 + r);
}

// 在 10 公分格線上從 (sx, sz) 找路到 (tx, tz)，會自己繞過家具、穿過門。
// 走不到的話停在最接近目標的地方。回傳路線點 [[x, z], ...]（不含起點）。
const CELL = 0.1;
export function findPath(sx, sz, tx, tz, r) {
  const x0 = Math.min(...WALK.map(w => w[0])), z0 = Math.min(...WALK.map(w => w[2]));
  const nx = Math.ceil((Math.max(...WALK.map(w => w[1])) - x0) / CELL) + 1;
  const nz = Math.ceil((Math.max(...WALK.map(w => w[3])) - z0) / CELL) + 1;
  const px = i => x0 + (i % nx) * CELL, pz = i => z0 + Math.floor(i / nx) * CELL;
  const okCache = new Int8Array(nx * nz);          // 0 未算、1 可走、2 不可走
  const ok = i => (okCache[i] || (okCache[i] = walkable(px(i), pz(i), r) ? 1 : 2)) === 1;
  const start = Math.round((sx - x0) / CELL) + Math.round((sz - z0) / CELL) * nx;
  const prev = new Int32Array(nx * nz).fill(-2);
  prev[start] = -1;
  const queue = [start];
  let best = start, bestD = Infinity;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], cx = i % nx, cz = Math.floor(i / nx);
    const d = Math.hypot(px(i) - tx, pz(i) - tz);
    if (d < bestD) { bestD = d; best = i; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ax = cx + dx, az = cz + dz;
      if (ax < 0 || az < 0 || ax >= nx || az >= nz) continue;
      const j = ax + az * nx;
      if (prev[j] !== -2 || !ok(j)) continue;
      if (dx && dz && (!ok(cx + dx + cz * nx) || !ok(cx + az * nx))) continue;   // 不切牆角
      prev[j] = i;
      queue.push(j);
    }
  }
  const pts = [];
  for (let i = best; i !== start && i >= 0; i = prev[i]) pts.push([px(i), pz(i)]);
  return pts.reverse();
}

// 整個屋子裡隨機挑一個走得到的點（大房間被挑中的機會比較大）
export function randomSpot(r) {
  const area = ([x1, x2, z1, z2]) => (x2 - x1) * (z2 - z1);
  const total = WALK.reduce((s, w) => s + area(w), 0);
  for (let tries = 0; tries < 30; tries++) {
    let pick = Math.random() * total, w = WALK[0];
    for (const c of WALK) { pick -= area(c); if (pick <= 0) { w = c; break; } }
    const x = w[0] + Math.random() * (w[1] - w[0]), z = w[2] + Math.random() * (w[3] - w[2]);
    if (walkable(x, z, r)) return [x, z];
  }
  return null;
}
