import { OBSTACLES } from './kit.js';
import { KITCHEN } from './kitchen.js';

// 廚房門口的寵物柵欄：平常關著（人和寵物都過不去），點一下打開或關上。
// 開著離開廚房時會跳出警示，關上後警示消失。
export function initGate({ scene, onChange }) {
  const gate = scene.getObjectByName('kitchenGate');
  const { door, zS } = KITCHEN;
  // 柵欄的兩個位置：打開時貼著門洞西側往廚房裡收；關上時橫擋整個門洞
  const OPEN = { x: door.x1 - 0.04, z: zS - 0.12, rot: 0 };
  const SHUT = { x: door.x1 + 0.03, z: zS - 0.05, rot: -Math.PI / 2 };
  const block = [door.x1, door.x2, zS - 0.1, zS + 0.02];
  const far = [99, 99, 99, 99];
  const obstacle = [...block];          // 放進共用碰撞清單；打開時移到很遠的地方
  OBSTACLES.push(obstacle);

  const state = { open: false, warning: false };
  let t = 0;                            // 動畫進度：0 關、1 開
  const place = () => {
    const k = t * t * (3 - 2 * t);
    gate.position.set(SHUT.x + (OPEN.x - SHUT.x) * k, 0, SHUT.z + (OPEN.z - SHUT.z) * k);
    gate.rotation.y = SHUT.rot + (OPEN.rot - SHUT.rot) * k;
  };
  place();

  function toggle() {
    state.open = !state.open;
    obstacle.splice(0, 4, ...(state.open ? far : block));
    if (!state.open) state.warning = false;
    onChange();
  }

  // 玩家從廚房走到別的房間時呼叫
  function leftKitchen() {
    if (state.open && !state.warning) { state.warning = true; onChange(); }
  }

  function update(dt) {
    const want = state.open ? 1 : 0;
    if (t === want) return false;
    t = want > t ? Math.min(1, t + dt * 3) : Math.max(0, t - dt * 3);
    place();
    return true;
  }

  return {
    state, update, leftKitchen,
    // 和任務物件一樣的點擊介面：隨時都可以點
    wants: id => id === 'gate',
    trigger: id => { if (id === 'gate') toggle(); },
  };
}
