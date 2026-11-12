import * as THREE from 'three';
import { SPACE, BUILD, OBSTACLES, WALK, ROOMS, scaleItem } from './kit.js';

// 把整間屋子從「配置座標」換算成實際大小：房間放大、家具不放大。
// 所有房間和任務物件都建好（都放在 world 群組裡）之後呼叫一次。
//
// - 房間結構（牆、地板、天花板、門框、門片、落地門、淋浴間隔間、柵欄）：留在 world 群組，平面放大 SPACE 倍
// - 家具：搬到不放大的 props 群組，尺寸不變。互相碰在一起的（層架和上面的牽繩、書桌和檯燈、
//   流理台和水槽）算同一組一起移動，相對位置不變。每一組在每個方向上：
//     靠近某面牆（0.4 公尺內）→ 和那面牆保持原本的距離（繼續貼著牆）
//     在房間中間 → 中心點照比例往外移
// - 碰撞範圍：跟著它所屬的那組家具一起移動，大小不變；房間結構的照比例放大
// - 可走範圍、房間範圍：照比例放大
const NEAR_WALL = 0.4;     // 離牆多近算「靠牆」（公尺）
const TOUCH = 0.015;       // 兩件東西相距多近算碰在一起

const hidden = m => m.material && m.material.opacity === 0;     // 看不見的點擊範圍，不算家具的外形

function boundsOf(o) {
  const box = new THREE.Box3(), part = new THREE.Box3();
  o.traverse(m => {
    if (!m.isMesh || hidden(m)) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.union(part.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld));
  });
  return box;
}
const hasMesh = o => { let found = false; o.traverse(m => { if (m.isMesh) found = true; }); return found; };

export function relayout(scene) {
  const world = scene.getObjectByName('world');
  world.scale.set(1, 1, 1);                         // 先回到配置座標量尺寸
  scene.updateMatrixWorld(true);

  const rooms = ROOMS.map(r => r.rect.slice());
  const roomOf = (x, z) => rooms.find(([x1, x2, z1, z2]) => x >= x1 && x <= x2 && z >= z1 && z <= z2);

  // 某個範圍 [x1, x2, z1, z2] 要移多少
  function offsetFor(x1, x2, z1, z2) {
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, room = roomOf(cx, cz);
    if (!room) return [cx * (SPACE - 1), cz * (SPACE - 1)];
    const axis = (lo, hi, a, b) => (lo - a < NEAR_WALL ? a : b - hi < NEAR_WALL ? b : (lo + hi) / 2) * (SPACE - 1);
    return [axis(x1, x2, room[0], room[1]), axis(z1, z2, room[2], room[3])];
  }

  /* ----- 找出家具，碰在一起的分成同一組 ----- */
  const items = world.children
    .filter(o => !o.userData.structural && hasMesh(o))
    .map(o => ({ o, box: boundsOf(o) }));
  const solid = items.filter(it => !it.box.isEmpty());
  const parent = solid.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const grown = solid.map(it => it.box.clone().expandByScalar(TOUCH));
  const roomIdx = solid.map(it => { const c = it.box.getCenter(new THREE.Vector3()); return rooms.indexOf(roomOf(c.x, c.z)); });
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    if (roomIdx[i] === roomIdx[j] && grown[i].intersectsBox(grown[j])) parent[find(i)] = find(j);
  }
  const groups = new Map();
  solid.forEach((it, i) => {
    const k = find(i);
    if (!groups.has(k)) groups.set(k, { box: new THREE.Box3(), members: [] });
    const gr = groups.get(k);
    gr.box.union(it.box);
    gr.members.push(it);
  });
  // 疊在一起（上下堆疊、或互相嵌進去）才算同一件：例如微波爐和它下面的櫃子
  const stacked = (a, b) => {
    const w = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
    const d = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
    return w > 0.01 && d > 0.01;
  };
  for (const gr of groups.values()) {
    const b = gr.box;
    gr.offset = offsetFor(b.min.x, b.max.x, b.min.z, b.max.z);
    for (const it of gr.members) it.offset = gr.offset;
    // 從一面牆一路接到對面牆的一整排（例如廚房西牆：流理台、白柱、矮櫃、層架），
    // 在那個方向上沒辦法整排一起移：拆成一件一件，各自靠近哪面牆就貼著哪面牆，中間的照比例分開
    const room = roomOf((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2);
    if (!room) continue;
    const spanX = b.min.x - room[0] < NEAR_WALL && room[1] - b.max.x < NEAR_WALL;
    const spanZ = b.min.z - room[2] < NEAR_WALL && room[3] - b.max.z < NEAR_WALL;
    if (!spanX && !spanZ) continue;
    const ms = gr.members, up = ms.map((_, i) => i);
    const top = i => (up[i] === i ? i : (up[i] = top(up[i])));
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      if (stacked(ms[i].box, ms[j].box) && ms[i].box.clone().expandByScalar(TOUCH).intersectsBox(ms[j].box)) up[top(i)] = top(j);
    }
    const pieces = new Map();
    ms.forEach((it, i) => { const k = top(i); if (!pieces.has(k)) pieces.set(k, new THREE.Box3()); pieces.get(k).union(it.box); });
    ms.forEach((it, i) => {
      const pb = pieces.get(top(i)), own = offsetFor(pb.min.x, pb.max.x, pb.min.z, pb.max.z);
      it.offset = [spanX ? own[0] : gr.offset[0], spanZ ? own[1] : gr.offset[1]];
    });
  }
  const list = [...groups.values()];

  // 只有看不見的點擊範圍的物件：跟著它所在位置的那組家具走
  const p = new THREE.Vector3();
  for (const it of items) {
    if (!it.box.isEmpty()) continue;
    it.o.getWorldPosition(p);
    const host = list
      .filter(gr => gr.box.clone().expandByScalar(0.3).containsPoint(p))
      .sort((a, b) => a.box.getSize(new THREE.Vector3()).lengthSq() - b.box.getSize(new THREE.Vector3()).lengthSq())[0];
    it.offset = host ? host.offset : offsetFor(p.x, p.x, p.z, p.z);
  }

  /* ----- 碰撞範圍：跟著重疊最多的那件家具 ----- */
  for (const r of OBSTACLES) {
    if (r.structural) { scaleItem(r); continue; }
    let best = null, bestArea = 0;
    for (const it of solid) {
      const w = Math.min(r[1], it.box.max.x) - Math.max(r[0], it.box.min.x);
      const d = Math.min(r[3], it.box.max.z) - Math.max(r[2], it.box.min.z);
      if (w > 0 && d > 0 && w * d > bestArea) { bestArea = w * d; best = it; }
    }
    const [ox, oz] = best ? best.offset : offsetFor(r[0], r[1], r[2], r[3]);
    r[0] += ox; r[1] += ox; r[2] += oz; r[3] += oz;
  }
  WALK.forEach(scaleItem);
  ROOMS.forEach(scaleItem);
  BUILD.laidOut = true;                 // 之後再加的碰撞範圍（例如柵欄）都直接照比例放大

  /* ----- 家具搬到不放大的群組 ----- */
  const props = new THREE.Group();
  props.name = 'props';
  scene.add(props);
  for (const it of items) {
    it.o.position.x += it.offset[0];
    it.o.position.z += it.offset[1];
    props.add(it.o);
  }
  world.scale.set(SPACE, 1, SPACE);
  scene.updateMatrixWorld(true);
}
