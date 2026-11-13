import * as THREE from 'three';
import { buildDog, buildCat } from './pets.js';
import { SPACE, BUILD, STYLE, WARM, OBSTACLES, WALK, ROOMS, ceilingLight, std, box, wall, wallRun, slab, cyl, ball, sprite, tileTexture, woodTexture, wallTexture } from './kit.js';
import { buildDogRoom, DOGROOM } from './dogroom.js';
import { buildKitchen, KITCHEN } from './kitchen.js';

// 座標：x 向東（+）、z 向南（+，大門側）、y 向上。單位：公尺。
// 尺寸為依照片與手繪平面圖估計。
export const ROOM = { W: 4.4, D: 3.8, H: 2.8 };
const HW = ROOM.W / 2, HD = ROOM.D / 2, H = ROOM.H;
export const DOORWAY = { x1: 1.15, x2: 2.05, h: 2.05 };
export const CORRIDOR = { x1: 1.0, x2: 2.2, len: 9.1 };

/* ---------- 房間外殼 ---------- */

function buildShell(g) {
  const wallMat = std(0xffffff, { map: wallTexture(), roughness: 0.9 });
  const tiles = tileTexture();

  const floorTex = tiles.clone();
  floorTex.repeat.set(ROOM.W / 0.6, ROOM.D / 0.6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.D), std(0xffffff, { map: floorTex, roughness: 0.45 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.structural = true;
  g.add(floor);

  const ceilTex = woodTexture('#d0a877', '#7a5632', 8);
  ceilTex.repeat.set(ROOM.W / 0.8, 1);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.D), std(0xffffff, { map: ceilTex }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  ceil.userData.structural = true;
  g.add(ceil);

  // 西牆、東牆
  wall(g, wallMat, -HW, H / 2, 0, ROOM.D, H, Math.PI / 2);
  wall(g, wallMat, HW, H / 2, 0, ROOM.D, H, -Math.PI / 2);

  // 北牆（留走廊門洞）
  const { x1, x2, h } = DOORWAY;
  wall(g, wallMat, (-HW + x1) / 2, H / 2, -HD, x1 + HW, H, 0);
  wall(g, wallMat, (x2 + HW) / 2, H / 2, -HD, HW - x2, H, 0);
  wall(g, wallMat, (x1 + x2) / 2, (h + H) / 2, -HD, x2 - x1, H - h, 0);

  // 門框與打開的門片（房間結構）
  BUILD.structural = true;
  const frame = std(0x3a2418, { roughness: 0.5 });
  box(g, 0.07, h, 0.14, frame, x1, h / 2, -HD);
  box(g, 0.07, h, 0.14, frame, x2, h / 2, -HD);
  box(g, x2 - x1 + 0.07, 0.07, 0.14, frame, (x1 + x2) / 2, h + 0.035, -HD);
  const leaf = new THREE.Group();
  leaf.position.set(x2 - 0.03, 0, -HD + 0.05);
  leaf.rotation.y = -Math.PI / 2 - 0.12;
  box(leaf, 0.84, 2.0, 0.04, frame, -0.42, 1.0, 0);
  box(leaf, 0.56, 0.7, 0.05, std(0x4a2f20, { roughness: 0.5 }), -0.42, 1.45, 0);
  box(leaf, 0.56, 0.6, 0.05, std(0x4a2f20, { roughness: 0.5 }), -0.42, 0.5, 0);
  g.add(leaf);
  BUILD.structural = false;

  buildSouthDoors(g, wallMat);
  buildCorridor(g, wallMat, tiles);
}

// 南牆：深色木框落地玻璃門（4 片）＋上方氣窗
function buildSouthDoors(room, wallMat) {
  const g = new THREE.Group();
  g.name = 'southDoors';
  g.userData.structural = true;          // 整面落地門是房間結構
  room.add(g);
  const wood = std(0x2c1a13, { roughness: 0.45 });
  const glass = std(0x0b0c10, { roughness: 0.08, metalness: 0.6 });
  const frosted = std(0x8d9296, { roughness: 0.9 });
  const fx1 = -1.8, fx2 = HW, topDoor = 2.08, topFrame = 2.62;

  // 門框以外的牆面（西側一小段、氣窗上方）
  wall(g, wallMat, (-HW + fx1) / 2, H / 2, HD, fx1 + HW, H, Math.PI);
  wall(g, wallMat, (fx1 + fx2) / 2, (topFrame + H) / 2, HD, fx2 - fx1, H - topFrame, Math.PI);

  const z = HD - 0.05, fw = fx2 - fx1, cx = (fx1 + fx2) / 2;
  box(g, fw, 0.12, 0.12, wood, cx, topDoor + 0.06, z);          // 門楣
  box(g, fw, 0.08, 0.12, wood, cx, topFrame - 0.04, z);         // 氣窗上緣
  box(g, 0.1, topFrame, 0.12, wood, fx1 + 0.05, topFrame / 2, z);
  box(g, 0.06, topFrame, 0.12, wood, fx2 - 0.03, topFrame / 2, z);

  // 氣窗 6 格
  const tw = fw / 6;
  for (let i = 0; i < 6; i++) {
    const x = fx1 + tw * (i + 0.5);
    box(g, tw - 0.06, topFrame - topDoor - 0.24, 0.03, i % 2 ? glass : frosted, x, (topDoor + topFrame) / 2 + 0.02, z);
    if (i) box(g, 0.06, topFrame - topDoor - 0.12, 0.1, wood, fx1 + tw * i, (topDoor + topFrame) / 2 + 0.02, z);
  }

  // 4 片門扇
  const pw = fw / 4;
  for (let i = 0; i < 4; i++) {
    const x = fx1 + pw * (i + 0.5);
    box(g, pw - 0.14, topDoor - 0.5, 0.02, glass, x, 0.42 + (topDoor - 0.5) / 2, z);
    box(g, pw - 0.02, 0.4, 0.05, wood, x, 0.2, z);               // 下方木板
    box(g, pw - 0.02, 0.08, 0.05, wood, x, topDoor - 0.04, z);
    box(g, 0.07, topDoor, 0.06, wood, x - pw / 2 + 0.035, topDoor / 2, z);
    box(g, 0.07, topDoor, 0.06, wood, x + pw / 2 - 0.035, topDoor / 2, z);
  }
  // 中間對開門把手
  const metal = std(0xb9b2a0, { metalness: 0.8, roughness: 0.3 });
  box(g, 0.02, 0.16, 0.04, metal, cx - 0.05, 1.0, z - 0.05);
  box(g, 0.02, 0.16, 0.04, metal, cx + 0.05, 1.0, z - 0.05);
}

// 走廊：西側依序是書房、主臥室（尚未建模，門關著）、狗房（可進入），盡頭是廚房
function buildCorridor(g, wallMat, tiles) {
  const { x1, x2, len } = CORRIDOR;
  const w = x2 - x1, cx = (x1 + x2) / 2, zEnd = -HD - len, hc = 2.5;

  const tex = tiles.clone();
  tex.repeat.set(w / 0.6, len / 0.6);
  slab(g, std(0xffffff, { map: tex, roughness: 0.45 }), x1, x2, zEnd, -HD, 0);
  slab(g, std(0xd9d2bd), x1, x2, zEnd, -HD, hc, false);

  const dd = DOGROOM.door;
  wallRun(g, wallMat, 'z', x1, zEnd, -HD, hc, Math.PI / 2, [[dd.z1, dd.z2, dd.h]]);
  wallRun(g, wallMat, 'z', x2, zEnd, -HD, hc, -Math.PI / 2);
  // 門洞兩側的走廊側牆面
  wall(g, wallMat, (x1 + DOORWAY.x1) / 2, hc / 2, -HD - 0.001, DOORWAY.x1 - x1, hc, Math.PI);
  wall(g, wallMat, (x2 + DOORWAY.x2) / 2, hc / 2, -HD - 0.001, x2 - DOORWAY.x2, hc, Math.PI);

  // 書房、主臥室的門
  const door = std(0x3a2418, { roughness: 0.5 });
  BUILD.structural = true;
  for (const z of [-3.2, -5.0]) box(g, 0.05, 2.0, 0.85, door, x1 + 0.02, 1.0, z);
  BUILD.structural = false;

  // 走廊盡頭：通往廚房的門洞
  const kd = KITCHEN.door;
  wallRun(g, wallMat, 'x', zEnd + 0.001, x1, x2, hc, 0, [[kd.x1, kd.x2, kd.h]]);
  const l1 = new THREE.PointLight(0xffe2b0, 0.9, 7 * SPACE, 0);
  l1.position.set(cx, 2.2, -HD - 4.5);
  g.add(l1);

  WALK.push([-HW, HW, -HD, HD], [DOORWAY.x1, DOORWAY.x2, -HD - 0.5, -HD + 0.5], [x1, x2, zEnd, -HD]);
  ROOMS.push({ name: '客廳', rect: [-HW, HW, -HD, HD], spot: [1.7, 1.5, 0.72], center: [0, 0.9, 0], r: 7.5, theta: 0.55 });
  ROOMS.push({ name: '走廊', rect: [x1, x2, zEnd, -HD] });
}

/* ---------- 家具 ---------- */

// 西牆：冷氣、電視、電視櫃、音響、電風扇、垃圾桶
function buildWestWall(g) {
  const x = -HW;
  const white = std(0xf4f4f2, { roughness: 0.35 });
  const black = std(0x0c0c0e, { roughness: 0.25 });

  // 冷氣
  box(g, 0.22, 0.3, 0.85, white, x + 0.11, 2.42, 1.15);
  box(g, 0.02, 0.05, 0.75, std(0xcfd2d4), x + 0.215, 2.3, 1.15);

  // 壁掛電視
  const tvZ = 0.25;
  box(g, 0.05, 0.64, 1.12, black, x + 0.06, 1.5, tvZ);
  box(g, 0.01, 0.58, 1.06, std(0x05060a, { roughness: 0.05, metalness: 0.5 }), x + 0.09, 1.5, tvZ).name = 'tvScreen';   // 看電視的畫面在 tv.js

  // 深色木電視櫃（玻璃門）
  const dark = std(0x3b2317, { roughness: 0.5 });
  box(g, 0.42, 0.5, 0.85, dark, x + 0.23, 0.31, tvZ);
  box(g, 0.46, 0.04, 0.9, dark, x + 0.23, 0.58, tvZ);
  for (const s of [-1, 1]) {
    box(g, 0.01, 0.3, 0.34, std(0x1a1412, { roughness: 0.1, metalness: 0.4 }), x + 0.445, 0.3, tvZ + s * 0.2);
    box(g, 0.05, 0.06, 0.05, dark, x + 0.08, 0.03, tvZ + s * 0.38);
    box(g, 0.05, 0.06, 0.05, dark, x + 0.4, 0.03, tvZ + s * 0.38);
  }
  OBSTACLES.push([x, x + 0.46, tvZ - 0.45, tvZ + 0.45]);

  // 床頭音響：主機＋兩顆喇叭
  box(g, 0.2, 0.12, 0.2, black, x + 0.22, 0.66, tvZ);
  box(g, 0.16, 0.22, 0.14, black, x + 0.22, 0.71, tvZ - 0.28);
  box(g, 0.16, 0.22, 0.14, black, x + 0.22, 0.71, tvZ + 0.28);

  // 體重計
  box(g, 0.28, 0.025, 0.28, white, x + 0.75, 0.013, tvZ - 0.25);

  // 立扇
  const fan = new THREE.Group();
  fan.position.set(x + 0.3, 0, 1.0);
  cyl(fan, 0.2, 0.2, 0.04, white, 0, 0.02, 0);
  cyl(fan, 0.02, 0.02, 0.75, white, 0, 0.4, 0, 10);
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 28), white);
  cage.position.set(0.06, 0.82, 0); cage.rotation.y = Math.PI / 2; fan.add(cage);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0xcfe6b8, transparent: true, opacity: 0.55 }));
  disc.position.set(0.06, 0.82, 0); disc.rotation.z = Math.PI / 2; fan.add(disc);
  g.add(fan);
  OBSTACLES.push([x + 0.1, x + 0.5, 0.8, 1.2]);

  // 兩個粉紅蓋垃圾桶
  for (const dz of [0, 0.3]) {
    box(g, 0.24, 0.3, 0.26, std(0xa9adb0), x + 0.6 + dz * 0.2, 0.15, 1.38 + dz);
    box(g, 0.25, 0.05, 0.27, std(0xec7f8f), x + 0.6 + dz * 0.2, 0.325, 1.38 + dz);
  }

  OBSTACLES.push([x + 0.47, x + 0.79, 1.25, 1.83]);     // 垃圾桶

  // 靠在門邊的白色板子
  const board = box(g, 0.7, 0.75, 0.02, white, -1.2, 0.37, HD - 0.2);
  board.rotation.x = 0.16;
  OBSTACLES.push([-1.55, -0.85, HD - 0.3, HD]);
}

// 北牆：書桌、椅子、松木層架
function buildNorthWall(g) {
  const z = -HD;
  const pineTex = woodTexture('#d2a565', '#8a5a2a', 4);
  const pine = std(0xffffff, { map: pineTex, roughness: 0.6 });
  const pinePlain = std(0xcfa569, { roughness: 0.65 });

  // 書桌
  const desk = std(0xc9a476, { roughness: 0.6 });
  const dx = -1.65;
  box(g, 0.9, 0.03, 0.5, desk, dx, 0.72, z + 0.27);
  box(g, 0.03, 0.72, 0.5, desk, dx - 0.43, 0.36, z + 0.27);
  box(g, 0.03, 0.72, 0.5, desk, dx + 0.43, 0.36, z + 0.27);
  box(g, 0.84, 0.3, 0.02, desk, dx, 0.5, z + 0.05);
  OBSTACLES.push([dx - 0.45, dx + 0.45, z, z + 0.52]);
  // 檯燈
  const white = std(0xf2f2f0, { roughness: 0.4 });
  cyl(g, 0.07, 0.07, 0.015, white, dx + 0.28, 0.745, z + 0.2);
  cyl(g, 0.008, 0.008, 0.32, white, dx + 0.28, 0.9, z + 0.2, 8);
  box(g, 0.3, 0.012, 0.04, white, dx + 0.14, 1.06, z + 0.2);
  // 桌上衣物
  box(g, 0.3, 0.1, 0.25, std(0x4a2440), dx - 0.2, 0.79, z + 0.25);

  // 辦公椅（披著外套）
  const chair = new THREE.Group();
  chair.position.set(dx - 0.1, 0, z + 0.85);
  const blk = std(0x1c1c1e, { roughness: 0.6 });
  cyl(chair, 0.26, 0.26, 0.04, blk, 0, 0.05, 0, 5);
  cyl(chair, 0.025, 0.025, 0.36, blk, 0, 0.25, 0, 8);
  box(chair, 0.44, 0.07, 0.44, blk, 0, 0.46, 0);
  box(chair, 0.42, 0.5, 0.06, blk, 0, 0.78, 0.2);
  box(chair, 0.5, 0.5, 0.1, std(0x3d4030, { roughness: 0.95 }), 0, 0.8, 0.22);
  g.add(chair);
  OBSTACLES.push([dx - 0.36, dx + 0.16, z + 0.6, z + 1.12]);

  // 橘色背包
  box(g, 0.28, 0.42, 0.18, std(0xd06a2c), -1.05, 0.21, z + 0.62).rotation.y = 0.3;

  // 松木層架（兩個單元）
  const sx1 = -0.95, sw = 0.86, depth = 0.5, sh = 2.26;
  const zc = z + depth / 2 + 0.03;
  const shelf = new THREE.Group();
  g.add(shelf);
  for (let i = 0; i <= 2; i++) {          // 梯形側柱
    const px = sx1 + i * sw;
    for (const pz of [zc - depth / 2 + 0.02, zc + depth / 2 - 0.02]) box(shelf, 0.035, sh, 0.045, pinePlain, px, sh / 2, pz);
    for (const py of [0.12, 0.6, 1.1, 1.6, 2.1]) box(shelf, 0.02, 0.04, depth - 0.08, pinePlain, px, py, zc);
  }
  for (let i = 0; i < 2; i++) {
    const cx = sx1 + sw * (i + 0.5), w = sw - 0.04;
    // 上櫃（兩片門）
    box(shelf, w, 0.82, depth - 0.02, pine, cx, 1.83, zc - 0.01);
    box(shelf, 0.006, 0.8, 0.01, std(0x8a5a2a), cx, 1.83, zc + depth / 2 - 0.015);
    // 開放層板
    for (const py of [1.02, 0.1]) box(shelf, w, 0.02, depth, pinePlain, cx, py, zc);
    if (i === 0) {
      // 左：兩個抽屜
      box(shelf, w, 0.38, depth, pine, cx, 0.74, zc);
      box(shelf, w - 0.02, 0.008, 0.01, std(0x8a5a2a), cx, 0.74, zc + depth / 2 + 0.002);
      box(shelf, w, 0.02, depth, pinePlain, cx, 0.34, zc);
    } else {
      // 右：下櫃
      box(shelf, w, 0.58, depth, pine, cx, 0.64, zc);
      box(shelf, 0.006, 0.56, 0.01, std(0x8a5a2a), cx, 0.64, zc + depth / 2 + 0.002);
    }
  }
  // 層板上的雜物
  box(shelf, 0.22, 0.05, 0.16, std(0xd9c7a0), -0.75, 1.055, zc);
  // 凍乾罐（右半邊、狗狗包旁邊）在任務三 feed.js 裡
  box(shelf, 0.3, 0.04, 0.3, std(0x2f6f6a, { roughness: 1 }), -0.65, 0.37, zc);
  // 掛在上櫃的綠色聖誕樹圍裙
  box(shelf, 0.34, 0.5, 0.015, std(0x2f5d43, { roughness: 1 }), -0.25, 1.95, zc + depth / 2 + 0.012);
  const tree = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 3), std(0x3f7a52, { roughness: 1 }));
  tree.position.set(-0.25, 1.9, zc + depth / 2 + 0.02);
  tree.scale.z = 0.1;
  shelf.add(tree);
  // 掛在右側的外套
  box(shelf, 0.06, 0.6, 0.3, std(0x24202a, { roughness: 1 }), sx1 + 2 * sw + 0.05, 0.75, zc);

  OBSTACLES.push([sx1 - 0.03, sx1 + 2 * sw + 0.08, z, z + depth + 0.05]);
}

// 沙發（面向西側電視）、白色櫃子
// 沙發北端與松木層架之間留約 0.7m 走道
const SOFA_Z = 0.2, CAB_Z = 1.48;
function buildCenter(g) {
  const fabric = std(0xa9a9a4, { roughness: 1 });
  const sage = std(0x9fb0a3, { roughness: 1 });
  const cream = std(0xefeadb, { roughness: 1 });
  const leg = std(0xd8b98a);

  const sofa = new THREE.Group();
  sofa.position.set(0.75, 0, SOFA_Z);
  const L = 1.7, Dp = 0.85;
  box(sofa, Dp, 0.2, L, fabric, 0, 0.27, 0);                         // 底座
  box(sofa, Dp - 0.22, 0.12, L - 0.24, fabric, -0.1, 0.42, 0);       // 座墊
  box(sofa, 0.2, 0.62, L, fabric, Dp / 2 - 0.1, 0.5, 0);             // 椅背
  box(sofa, Dp, 0.4, 0.12, fabric, 0, 0.42, -L / 2 + 0.06);          // 扶手
  box(sofa, Dp, 0.4, 0.12, fabric, 0, 0.42, L / 2 - 0.06);
  for (const s of [-1, 1]) {                                          // 灰綠色靠墊
    const c = box(sofa, 0.16, 0.4, L / 2 - 0.16, sage, Dp / 2 - 0.26, 0.66, s * (L / 4 - 0.05));
    c.rotation.z = -0.14;
  }
  box(sofa, 0.24, 0.02, L - 0.2, sage, Dp / 2 - 0.1, 0.82, 0);       // 披在椅背的布
  box(sofa, 0.55, 0.03, 1.1, cream, -0.12, 0.495, 0.1).rotation.y = 0.05; // 白色毯子
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(sofa, 0.02, 0.014, 0.17, leg, sx * (Dp / 2 - 0.07), 0.085, sz * (L / 2 - 0.08), 8);
  g.add(sofa);
  OBSTACLES.push([0.75 - Dp / 2, 0.75 + Dp / 2, SOFA_Z - L / 2, SOFA_Z + L / 2]);

  // 沙發上的後背包
  box(g, 0.3, 0.36, 0.2, std(0x5d6456, { roughness: 1 }), 0.72, 0.66, SOFA_Z + 0.55);

  // 白色雙門櫃（門朝東、背板朝西）
  const white = std(0xf6f6f4, { roughness: 0.4 });
  const cab = new THREE.Group();
  cab.position.set(0.95, 0, CAB_Z);
  const cw = 0.42, cl = 0.75, ch = 1.2;
  box(cab, cw, ch, cl, white, 0, ch / 2, 0);
  box(cab, 0.005, ch - 0.04, cl - 0.02, std(0xa98c62, { roughness: 0.9 }), -cw / 2 - 0.003, ch / 2, 0); // 背板
  box(cab, 0.004, ch - 0.12, 0.006, std(0xcfcfcc), cw / 2 + 0.002, ch / 2 + 0.03, 0);                  // 門縫
  const knob = std(0xe8e8e4);
  cyl(cab, 0.012, 0.012, 0.03, knob, cw / 2 + 0.015, 0.95, -0.06, 10).rotation.z = Math.PI / 2;
  cyl(cab, 0.012, 0.012, 0.03, knob, cw / 2 + 0.015, 0.95, 0.06, 10).rotation.z = Math.PI / 2;
  box(cab, 0.2, 0.05, 0.003, std(0xf2a5c8), 0, 1.08, -cl / 2 - 0.002);                                 // 粉紅便條
  g.add(cab);
  OBSTACLES.push([0.95 - cw / 2, 0.95 + cw / 2, CAB_Z - cl / 2, CAB_Z + cl / 2]);
}

// 東牆與門口：吸塵器、插座、配電箱、腳踏墊、拖鞋、貓用品
function buildEastAndEntry(g) {
  const x = HW;
  // 配電箱
  box(g, 0.03, 0.26, 0.48, std(0xb9b59c, { roughness: 0.6 }), x - 0.015, 1.72, 1.2);
  box(g, 0.035, 0.2, 0.4, std(0xa7a38b, { roughness: 0.6 }), x - 0.018, 1.72, 1.2);
  // 插座與充電線
  box(g, 0.015, 0.11, 0.07, std(0xf4f4f0), x - 0.008, 1.05, 0.2);
  box(g, 0.01, 0.6, 0.01, std(0xf4f4f0), x - 0.01, 0.75, 0.22);

  // 直立式無線吸塵器與立架
  const vac = new THREE.Group();
  vac.position.set(x - 0.18, 0, 1.45);
  const dk = std(0x33343a, { roughness: 0.4 });
  box(vac, 0.26, 0.02, 0.26, dk, 0, 0.01, 0);
  cyl(vac, 0.015, 0.015, 1.25, dk, 0.08, 0.63, 0, 8);
  cyl(vac, 0.016, 0.016, 0.75, std(0x8f8f96, { metalness: 0.6, roughness: 0.3 }), -0.03, 0.55, 0, 8);
  box(vac, 0.08, 0.05, 0.24, dk, -0.03, 0.14, 0);
  cyl(vac, 0.055, 0.055, 0.2, std(0xd9a321, { roughness: 0.35 }), -0.03, 1.02, 0);
  cyl(vac, 0.05, 0.05, 0.07, std(0x2f9aa0, { roughness: 0.35 }), -0.03, 1.16, 0);
  box(vac, 0.05, 0.16, 0.05, dk, -0.1, 1.05, 0);
  g.add(vac);
  OBSTACLES.push([x - 0.31, x - 0.05, 1.32, 1.58]);

  // 腳踏墊與拖鞋
  box(g, 0.75, 0.012, 0.45, std(0x2a2f45, { roughness: 1 }), 1.7, 0.006, HD - 0.4);
  for (const dx of [0, 0.13]) {
    const s = ball(g, 0.06, std(0xc6c8cc, { roughness: 0.7 }), 1.6 + dx, 0.045, HD - 0.4, 0.9, 0.6, 2);
    s.rotation.y = 0.5;
  }

  // 收納盒（飼料袋與狗碗在任務三 feed.js 裡）
  const bin = box(g, 0.28, 0.2, 0.36, new THREE.MeshStandardMaterial({ color: 0xd9e3ea, transparent: true, opacity: 0.6, roughness: 0.3 }), 1.34, 0.1, HD - 0.25);
  bin.castShadow = false;
  box(g, 0.29, 0.02, 0.37, std(0x8c98a6), 1.34, 0.21, HD - 0.25);
  OBSTACLES.push([1.2, 1.48, HD - 0.43, HD]);

  // 地上的玩具與啞鈴
  ball(g, 0.055, std(0xe5c020, { roughness: 0.7 }), -0.25, 0.05, -0.75, 1.6, 0.9, 1);
  const iron = std(0x27304a, { roughness: 0.5 });
  for (const dz of [0, 0.16]) {
    const d = new THREE.Group();
    d.position.set(-0.05, 0.05, -1.05 + dz);
    cyl(d, 0.015, 0.015, 0.2, iron, 0, 0, 0, 8).rotation.z = Math.PI / 2;
    cyl(d, 0.05, 0.05, 0.05, iron, -0.09, 0, 0, 6).rotation.z = Math.PI / 2;
    cyl(d, 0.05, 0.05, 0.05, iron, 0.09, 0, 0, 6).rotation.z = Math.PI / 2;
    g.add(d);
  }
  // 啞鈴和玩具不設碰撞：它們剛好在沙發和層架中間唯一的走道上，設了會把客廳西半邊封死
}

/* ---------- 組裝 ---------- */

export function buildLivingRoom(scene) {
  const g = new THREE.Group();
  buildShell(g);
  buildWestWall(g);
  buildNorthWall(g);
  buildCenter(g);
  buildEastAndEntry(g);
  buildDogRoom(g);
  buildKitchen(g);

  // 屋子的群組：建好所有東西後由 layout.js 換算成實際大小（房間放大、家具不放大）。
  // 寵物不放進這個群組
  g.name = 'world';

  // 巴福柔一開始站在沙發後方通往走廊的走道，之後會在屋裡到處走
  const dog = buildDog();
  dog.position.set(1.76 * SPACE, 0, -0.55 * SPACE);
  dog.rotation.y = Math.PI * 0.85;      // 面向大門
  scene.add(dog);

  // 兩隻貓：大的在客廳地上，小的（比較小一號）在走廊，之後也會到處走
  const cat = buildCat();
  cat.position.set(-0.4 * SPACE, 0, 1.0 * SPACE);
  cat.rotation.y = Math.PI * 0.4;
  scene.add(cat);
  const kitten = buildCat();
  kitten.scale.setScalar(0.75);
  kitten.position.set(1.6 * SPACE, 0, -4.2 * SPACE);
  kitten.rotation.y = -Math.PI * 0.3;
  scene.add(kitten);

  // 燈光：吸頂燈
  g.add(new THREE.HemisphereLight(WARM.sky, WARM.ground, STYLE.ambient * WARM.boost));
  ceilingLight(g, -0.2, H - 0.08, 0.2, 9, 2048);
  cyl(g, 0.16, 0.18, 0.06, new THREE.MeshBasicMaterial({ color: 0xfffbea }), -0.2, H - 0.03, 0.2).castShadow = false;

  scene.add(g);
  return { group: g, dog, cat, kitten, southDoors: g.getObjectByName('southDoors') };
}
