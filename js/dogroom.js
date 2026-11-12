import * as THREE from 'three';
import { OBSTACLES, WALK, ROOMS, ceilingLight, std, box, wallRun, slab, cyl, ball, canvasTexture, speckle, tileTexture, woodTexture, wallTexture } from './kit.js';

// 狗房（走廊最裡面、西側的房間）與它附的廁所。尺寸為依照片估計。
// 狗房門開在走廊西牆（狗房東牆）靠北端；廁所在狗房南側，門開在狗房南牆靠東端。
export const DOGROOM = {
  x1: -2.2, x2: 1.0, zN: -11.0, zS: -8.0, H: 2.8,
  door: { z1: -10.9, z2: -10.05, h: 2.05 },
};
const BATH = { x1: -0.6, x2: 0.9, zN: -8.0, zS: -5.6, H: 2.4, door: { x1: 0.15, x2: 0.85, h: 2.0 } };

// 灰色壁磚：淺灰大理石紋，白色磚縫；一張 = 0.6m x 0.6m（兩排交丁）
function bathWallTexture() {
  return canvasTexture(32, (g, s) => {
    speckle(g, s, [210, 6, 68], 8);
    g.fillStyle = '#e6e8ea';
    g.fillRect(0, 0, s, 1); g.fillRect(0, 16, s, 1);
    g.fillRect(0, 0, 1, 16); g.fillRect(16, 16, 1, 16);
  });
}
function bathFloorTexture() {
  return canvasTexture(32, (g, s) => {
    speckle(g, s, [215, 8, 27], 6);
    g.fillStyle = '#1c1e22';
    g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
  });
}
// 木紋壁板：直條溝縫
function panelTexture() {
  return woodTexture('#c69b6a', '#6e4a28', 2);
}

function repeated(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  return t;
}

function buildRoom(g) {
  const { x1, x2, zN, zS, H, door } = DOGROOM;
  const wallMat = std(0xffffff, { map: wallTexture(), roughness: 0.9 });
  const panelMat = std(0xffffff, { map: panelTexture(), roughness: 0.7 });
  const dark = std(0x3a2418, { roughness: 0.5 });
  const white = std(0xf2f2ee, { roughness: 0.5 });
  const bd = BATH.door;

  slab(g, std(0xffffff, { map: repeated(tileTexture(), (x2 - x1) / 0.6, (zS - zN) / 0.6), roughness: 0.45 }), x1, x2, zN, zS, 0);
  const ceilTex = woodTexture('#d0a877', '#7a5632', 8);
  ceilTex.repeat.set((x2 - x1) / 0.8, 1);
  slab(g, std(0xffffff, { map: ceilTex }), x1, x2, zN, zS, H, false);

  wallRun(g, wallMat, 'x', zN, x1, x2, H, 0);                                  // 北
  wallRun(g, wallMat, 'x', zS, x1, x2, H, Math.PI, [[bd.x1, bd.x2, bd.h]]);    // 南（廁所門）
  wallRun(g, wallMat, 'z', x1, zN, zS, H, Math.PI / 2);                        // 西（窗）
  wallRun(g, panelMat, 'z', x2, zN, zS, H, -Math.PI / 2, [[door.z1, door.z2, door.h]]); // 東（木紋壁板、房門）

  // 房門框與向內打開、貼著北牆的門片
  const dz = (door.z1 + door.z2) / 2;
  box(g, 0.16, door.h, 0.06, dark, x2, door.h / 2, door.z1);
  box(g, 0.16, door.h, 0.06, dark, x2, door.h / 2, door.z2);
  box(g, 0.16, 0.06, door.z2 - door.z1 + 0.06, dark, x2, door.h + 0.03, dz);
  box(g, 0.82, 2.0, 0.04, dark, x2 - 0.47, 1.0, zN + 0.06);
  box(g, 0.5, 0.6, 0.05, std(0x4a2f20, { roughness: 0.5 }), x2 - 0.47, 1.5, zN + 0.06);
  box(g, 0.5, 0.5, 0.05, std(0x4a2f20, { roughness: 0.5 }), x2 - 0.47, 0.45, zN + 0.06);
  box(g, 0.1, 0.02, 0.05, std(0xb9b2a0, { metalness: 0.8, roughness: 0.3 }), x2 - 0.8, 1.0, zN + 0.1);

  // 廁所門框（白色）
  box(g, 0.05, bd.h, 0.14, white, bd.x1, bd.h / 2, zS);
  box(g, 0.05, bd.h, 0.14, white, bd.x2, bd.h / 2, zS);
  box(g, bd.x2 - bd.x1 + 0.05, 0.05, 0.14, white, (bd.x1 + bd.x2) / 2, bd.h + 0.025, zS);

  // 西牆：鐵窗與冷氣
  const wz = -9.6;
  box(g, 0.04, 0.72, 1.0, white, x1 + 0.02, 1.35, wz);
  box(g, 0.02, 0.6, 0.88, std(0x23262b, { roughness: 0.2 }), x1 + 0.045, 1.35, wz);
  box(g, 0.03, 0.6, 0.04, white, x1 + 0.05, 1.35, wz);
  for (let i = -3; i <= 3; i++) if (i) box(g, 0.012, 0.6, 0.02, std(0xc9c4b4), x1 + 0.05, 1.35, wz + i * 0.11);
  for (const y of [1.2, 1.5]) box(g, 0.012, 0.02, 0.88, std(0xc9c4b4), x1 + 0.05, y, wz);
  box(g, 0.22, 0.3, 0.85, white, x1 + 0.11, 2.42, wz);
  box(g, 0.02, 0.06, 0.8, std(0x9aa0a6), x1 + 0.215, 2.32, wz);

  // 單人床：深色床架＋床墊，床頭在南側
  const bz = zS - 1.0, bx = x1 + 0.47;
  box(g, 0.92, 0.22, 1.92, std(0x241a16, { roughness: 0.6 }), bx, 0.11, bz);
  box(g, 0.9, 0.2, 1.9, std(0xd8d0d8, { roughness: 1 }), bx, 0.32, bz);
  box(g, 0.91, 0.03, 1.91, std(0xbfae9a, { roughness: 1 }), bx, 0.23, bz);
  box(g, 0.45, 0.08, 0.28, std(0x8f9296, { roughness: 1 }), bx - 0.1, 0.46, zS - 0.25);          // 灰色枕頭
  const blanket = box(g, 0.6, 0.1, 0.7, std(0x6fae9a, { roughness: 1 }), bx + 0.08, 0.47, zS - 0.75); // 綠格紋被子
  blanket.rotation.y = 0.35;
  OBSTACLES.push([x1, x1 + 0.93, zS - 1.96, zS]);

  // 西北角地上的白色板子
  box(g, 0.55, 0.04, 0.6, white, x1 + 0.35, 0.02, zN + 0.38);

  // 開關與插座
  box(g, 0.01, 0.12, 0.07, white, x2 - 0.006, 1.2, door.z2 + 0.2);
  box(g, 0.01, 0.07, 0.11, white, x2 - 0.006, 0.35, door.z2 + 0.3);
  box(g, 0.07, 0.11, 0.01, white, bd.x1 - 0.25, 1.15, zS - 0.006);

  // 吸頂燈
  cyl(g, 0.16, 0.18, 0.06, new THREE.MeshBasicMaterial({ color: 0xfffbea }), (x1 + x2) / 2, H - 0.03, (zN + zS) / 2);

  ceilingLight(g, (x1 + x2) / 2, H - 0.08, (zN + zS) / 2, 7);
  WALK.push([x1, x2, zN, zS], [x2 - 0.5, x2 + 0.5, door.z1, door.z2]);
  ROOMS.push({ name: '狗房', rect: [x1, x2, zN, zS], spot: [0.2, -10.4, Math.PI * 0.62], center: [-0.6, 0.9, -9.3], r: 8, theta: Math.PI * 1.22 });
}

function buildBath(g) {
  const { x1, x2, zN, zS, H, door } = BATH;
  const tile = bathWallTexture();
  const wallMat = std(0xffffff, { map: tile, roughness: 0.4 });
  const floorMat = std(0xffffff, { map: repeated(bathFloorTexture(), (x2 - x1) / 0.6, (zS - zN) / 0.6), roughness: 0.5 });
  const white = std(0xf6f6f4, { roughness: 0.3 });
  const cream = std(0xe6dfc8, { roughness: 0.5 });
  const chrome = std(0xc8ccd0, { metalness: 0.8, roughness: 0.25 });
  const darkTile = std(0x3a3d42, { roughness: 0.5 });

  slab(g, floorMat, x1, x2, zN, zS, 0.001);
  slab(g, std(0xeeeeea), x1, x2, zN, zS, H, false);
  wallRun(g, wallMat, 'x', zN, x1, x2, H, 0, [[door.x1, door.x2, door.h]]);
  wallRun(g, wallMat, 'x', zS, x1, x2, H, Math.PI);
  wallRun(g, wallMat, 'z', x1, zN, zS, H, Math.PI / 2);
  wallRun(g, wallMat, 'z', x2, zN, zS, H, -Math.PI / 2);

  // 向內打開、貼著東牆的白色門片（下方有通風百葉）
  box(g, 0.04, 1.96, 0.66, white, x2 - 0.05, 0.98, zN + 0.38);
  box(g, 0.045, 0.2, 0.36, std(0xd6d6d2), x2 - 0.05, 0.3, zN + 0.38);
  ball(g, 0.03, chrome, x2 - 0.09, 1.0, zN + 0.66);

  // 淋浴間：最裡面整個寬度都是。奶油色框、霧面拉門（進門看過去左半邊開著）
  const sz = zS - 1.0, sh = 1.9, mid = (x1 + x2) / 2;
  const frosted = new THREE.MeshStandardMaterial({ color: 0xaeb4ba, transparent: true, opacity: 0.75, roughness: 0.6 });
  box(g, x2 - x1, 0.1, 0.06, darkTile, mid, 0.05, sz);                             // 門檻
  box(g, x2 - x1, 0.04, 0.05, cream, mid, sh, sz);                                 // 上框
  for (const x of [x1 + 0.02, mid, x2 - 0.02]) box(g, 0.04, sh, 0.05, cream, x, sh / 2, sz);
  box(g, mid - x1 - 0.04, sh - 0.14, 0.015, frosted, (x1 + mid) / 2, sh / 2 + 0.03, sz);
  box(g, x2 - x1 - 0.02, 0.35, 0.02, darkTile, mid, 0.175, zS - 0.01);             // 牆面下緣深色磚
  OBSTACLES.push([x1, mid, sz - 0.04, sz + 0.04]);
  // 淋浴間內的置物架與尿布墊
  box(g, 0.02, 0.06, 0.25, std(0x2f8f6a), x2 - 0.02, 1.15, zS - 0.5);
  box(g, 0.7, 0.012, 0.5, std(0xf4f4f2, { roughness: 1 }), 0.4, 0.012, zS - 0.5);

  // 馬桶：進門右手邊（西牆）靠裡面，緊鄰淋浴間，面向東
  const tz = sz - 0.32;
  const toilet = new THREE.Group();
  toilet.position.set(x1, 0, tz);
  box(toilet, 0.18, 0.36, 0.36, white, 0.11, 0.6, 0);                              // 水箱
  box(toilet, 0.5, 0.4, 0.3, white, 0.38, 0.2, 0);                                 // 底座
  cyl(toilet, 0.2, 0.17, 0.08, white, 0.45, 0.42, 0).scale.x = 1.25;               // 座圈
  cyl(toilet, 0.14, 0.14, 0.085, std(0xb8d8e8, { roughness: 0.2 }), 0.45, 0.42, 0).scale.x = 1.25;
  box(toilet, 0.03, 0.42, 0.36, white, 0.23, 0.66, 0).rotation.z = 0.15;           // 掀起的馬桶蓋
  g.add(toilet);
  OBSTACLES.push([x1, x1 + 0.72, tz - 0.2, tz + 0.2]);

  // 洗手台：進門右手邊（西牆）最靠門口，上方是鏡子與玻璃層板
  const kz = zN + 0.42;
  box(g, 0.42, 0.16, 0.52, white, x1 + 0.23, 0.78, kz);
  box(g, 0.2, 0.7, 0.24, white, x1 + 0.12, 0.35, kz);
  box(g, 0.28, 0.02, 0.36, std(0xdfe6ea, { roughness: 0.15 }), x1 + 0.25, 0.855, kz);
  cyl(g, 0.018, 0.018, 0.14, chrome, x1 + 0.07, 0.93, kz, 8);
  box(g, 0.12, 0.02, 0.03, chrome, x1 + 0.12, 0.99, kz);
  box(g, 0.02, 0.55, 0.45, std(0xb9c6cc, { metalness: 0.7, roughness: 0.1 }), x1 + 0.012, 1.5, kz);
  box(g, 0.12, 0.012, 0.5, std(0xcfe0e4, { roughness: 0.1 }), x1 + 0.07, 1.12, kz);
  box(g, 0.05, 0.14, 0.05, std(0xd9c21e), x1 + 0.06, 1.2, kz - 0.15);              // 清潔劑
  box(g, 0.1, 0.05, 0.16, std(0x7fb86a), x1 + 0.07, 1.15, kz + 0.14);              // 濕紙巾
  OBSTACLES.push([x1, x1 + 0.45, kz - 0.27, kz + 0.27]);
  // 通馬桶吸把（馬桶與洗手台之間）
  cyl(g, 0.06, 0.07, 0.05, std(0x151515), x1 + 0.55, 0.025, (kz + tz) / 2 + 0.05);
  cyl(g, 0.012, 0.012, 0.42, std(0xb02a2a), x1 + 0.55, 0.25, (kz + tz) / 2 + 0.05, 8);

  // 東牆的毛巾架與置物架
  box(g, 0.24, 0.02, 0.6, chrome, x2 - 0.13, 1.7, zN + 1.3);
  box(g, 0.2, 0.14, 0.4, white, x2 - 0.12, 1.78, zN + 1.3);
  box(g, 0.02, 0.02, 0.55, chrome, x2 - 0.07, 1.1, zN + 1.3);
  box(g, 0.06, 0.2, 0.06, std(0xf0f0e8), x2 - 0.1, 1.5, zN + 1.15);

  // 地上的尿布墊、地板排水孔
  const pad = box(g, 0.45, 0.012, 0.9, std(0xf4f4f2, { roughness: 1 }), 0.4, 0.012, zN + 0.95);
  pad.rotation.y = 0.2;
  box(g, 0.12, 0.006, 0.12, chrome, x1 + 0.6, 0.006, zN + 0.75);

  // 吸頂燈與抽風機
  cyl(g, 0.14, 0.16, 0.08, new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.15, H - 0.04, zN + 1.2);
  box(g, 0.2, 0.02, 0.2, std(0xdcdcd8), 0.4, H - 0.01, zS - 0.8);

  ceilingLight(g, 0.15, H - 0.1, zN + 1.2, 5, 1024, 0.8);
  WALK.push([x1, x2, zN, zS], [door.x1, door.x2, zN - 0.5, zN + 0.5]);
  ROOMS.push({ name: '廁所', rect: [x1, x2, zN, zS], spot: [0.5, -7.75, Math.PI], center: [0.15, 0.9, -6.9], r: 5.5, theta: Math.PI * 1.75 });
}

export function buildDogRoom(g) {
  buildRoom(g);
  buildBath(g);
}
