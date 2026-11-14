import { findPath, roomAt } from './nav.js';

// 畫面上方的目標方向箭頭：沿著走得到的路，指出往目前任務最近的目標下一步該往哪走，
// 並寫出目標在哪個房間或還有多遠。
//   quests：所有任務；fp：玩家位置與方向；radius()：玩家的身體半徑（俯瞰時回傳 null，不顯示）
// 回傳 update(time)，每一幀呼叫
export function initCompass({ quests, fp, radius }) {
  const box = document.getElementById('compass');
  const arrow = document.getElementById('compass-arrow');
  const text = document.getElementById('compass-text');
  let guide = null, guideAt = -1;     // guide：路線上前方約 1.2m 的點；每 0.4 秒重算一次

  return function update(time) {
    const active = quests.find(m => m.state.active);
    const r = radius();
    const pts = active && r !== null ? active.pointers.filter(p => p.visible) : [];
    if (!pts.length) { box.hidden = true; guide = null; guideAt = -1; return; }
    const away = p => Math.hypot(p.position.x - fp.x, p.position.z - fp.z);
    const t = pts.reduce((a, b) => (away(a) <= away(b) ? a : b)).position;
    const dist = Math.hypot(t.x - fp.x, t.z - fp.z);
    const there = roomAt(t.x, t.z), here = roomAt(fp.x, fp.z);
    if (!guide || time - guideAt > 0.4) {
      guideAt = time;
      const route = findPath(fp.x, fp.z, t.x, t.z, r);
      let left = 1.2, px = fp.x, pz = fp.z;
      guide = [t.x, t.z];
      for (const [x, z] of route) { left -= Math.hypot(x - px, z - pz); px = x; pz = z; if (left <= 0) { guide = [x, z]; break; } }
    }
    const dx = guide[0] - fp.x, dz = guide[1] - fp.z;
    const fwd = -Math.sin(fp.yaw) * dx - Math.cos(fp.yaw) * dz, right = Math.cos(fp.yaw) * dx - Math.sin(fp.yaw) * dz;
    arrow.style.transform = `rotate(${Math.atan2(right, fwd)}rad)`;
    text.textContent = there && there !== here ? `目標在${there}` : dist < 1.7 ? '就在附近' : `目標在 ${dist.toFixed(1)} 公尺外`;
    box.hidden = false;
  };
}
