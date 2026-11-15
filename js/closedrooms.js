import * as THREE from 'three';
import { BUILD, WARM, std, box } from './kit.js';
import { ROOM, CORRIDOR } from './livingroom.js';
import { BATH } from './dogroom.js';

// 走廊西側還沒做進來的兩個房間：書房、主臥室（門關著，不能進去）。
// 做成蓋著屋頂的實心房間，俯瞰時看得出是屋子的一部分、屋頂寫著房間名稱，而不是一塊空地（看起來像院子）。
// 範圍是照走廊上兩扇門的位置推估的：書房在第一扇門那一段；主臥室在第二扇門那一段，
// 往後繞過狗房廁所的西側（L 形）。每一塊都往內縮一點點，才不會和隔壁房間的牆面重疊。
const HD = ROOM.D / 2;
const IN = 0.02;
const H = 2.5;                        // 和走廊天花板一樣高
const SPLIT = -4.1;                   // 書房和主臥室的分界（兩扇門中間）

// [x1, x2, z1, z2, 屋頂上的字, 不畫邊框的那一邊]：主臥室是兩塊拼成的 L 形，相接的那條邊不畫框，看起來才是同一間
const BLOCKS = [
  [-ROOM.W / 2, CORRIDOR.x1, SPLIT, -HD, '書房'],
  [-ROOM.W / 2, CORRIDOR.x1, BATH.zS, SPLIT, '主臥室', 'north'],
  [-ROOM.W / 2, BATH.x1, BATH.zN, BATH.zS, '', 'south'],
];

// 屋頂：米色、深一點的邊，中間寫房間名稱和「門關著」（等像素字體載入後再寫一次）。
// 貼圖的上緣是北邊（-z），從預設的俯瞰角度（南邊）看過去字是正的
function roofTexture(name, w, d, open) {
  const S = 40;                                          // 每公尺幾個像素
  const c = document.createElement('canvas');
  c.width = Math.round(w * S); c.height = Math.round(d * S);
  const g = c.getContext('2d');
  const paint = () => {
    g.fillStyle = '#cbb49a';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#a88e72';
    const W = c.width, D = c.height, t = 4;
    if (open !== 'north') g.fillRect(0, 0, W, t);
    if (open !== 'south') g.fillRect(0, D - t, W, t);
    g.fillRect(0, 0, t, D);
    g.fillRect(W - t, 0, t, D);
    if (!name) return;
    g.fillStyle = '#6b4a30';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '36px "Cubic 11", sans-serif';
    g.fillText(name, c.width / 2, c.height / 2 - 12);
    g.font = '24px "Cubic 11", sans-serif';
    g.fillStyle = '#8a6a4c';
    g.fillText('（門關著）', c.width / 2, c.height / 2 + 22);
  };
  paint();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (document.fonts) document.fonts.load('36px "Cubic 11"').then(() => { paint(); tex.needsUpdate = true; });
  return tex;
}

export function buildClosedRooms(g) {
  const [h, s, l] = WARM.wall;
  const side = std(new THREE.Color().setHSL(h / 360, s / 100, l / 100).getHex(), { roughness: 0.9 });
  BUILD.structural = true;                               // 房間結構：跟著屋子一起放大
  for (const [x1, x2, z1, z2, name, open] of BLOCKS) {
    const w = x2 - x1 - IN * 2, d = z2 - z1 - IN * 2;
    const roof = std(0xffffff, { map: roofTexture(name, w, d, open), roughness: 1 });
    const m = box(g, w, H, d, side, (x1 + x2) / 2, H / 2, (z1 + z2) / 2);
    m.material = [side, side, roof, side, side, side];     // 只有上面是屋頂
    m.raycast = () => {};
  }
  BUILD.structural = false;
}
