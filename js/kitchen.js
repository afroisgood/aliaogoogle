import * as THREE from 'three';
import { OBSTACLES, WALK, ROOMS, ceilingLight, std, box, wall, wallRun, slab, cyl, canvasTexture, speckle, woodTexture, wallTexture } from './kit.js';

// 廚房：走廊盡頭，佔整個屋寬。尺寸為依照片估計。
// 從走廊進來（南牆靠東端的門洞，有寵物柵欄）：
//   西牆（左手邊）由近到遠：白色層架、木紋矮櫃、白柱、磁磚流理台
//   北牆（正對面）由左到右：磁磚流理台（水槽、抽油煙機）、木門、鐵窗、冰箱
//   東牆（右手邊）：木紋壁板，地上是飯碗與飼料桶
export const KITCHEN = {
  x1: -2.2, x2: 2.2, zN: -15.0, zS: -11.0, H: 2.8,
  door: { x1: 1.1, x2: 1.9, h: 2.0 },
};

function floorTexture() {
  return canvasTexture(32, (g, s) => {
    speckle(g, s, [215, 8, 30], 6);
    g.fillStyle = '#6d7178';
    g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
    g.fillRect(0, 16, s, 1); g.fillRect(16, 0, 1, s);
  });
}
// 米白小方磚
function splashTexture() {
  return canvasTexture(32, (g, s) => {
    speckle(g, s, [48, 30, 88], 4);
    g.fillStyle = '#9a968a';
    for (let i = 0; i < s; i += 4) { g.fillRect(i, 0, 1, s); g.fillRect(0, i, s, 1); }
  });
}

export function buildKitchen(g) {
  const { x1, x2, zN, zS, H, door } = KITCHEN;
  const wallMat = std(0xffffff, { map: wallTexture(), roughness: 0.5 });
  const panelMat = std(0xffffff, { map: woodTexture('#c69b6a', '#6e4a28', 2), roughness: 0.7 });
  const splash = std(0xffffff, { map: splashTexture(), roughness: 0.4 });
  const white = std(0xf4f4f0, { roughness: 0.45 });
  const cream = std(0xe9e4d0, { roughness: 0.5 });
  const greenTop = std(0xb5cf9c, { roughness: 0.4 });
  const black = std(0x141416, { roughness: 0.5 });
  const steel = std(0xb4b8bc, { metalness: 0.75, roughness: 0.3 });
  const oak = std(0xffffff, { map: woodTexture('#d8c3a0', '#a58a60', 1), roughness: 0.7 });
  const doorWood = std(0xffffff, { map: woodTexture('#b9824a', '#6e4420', 1), roughness: 0.6 });

  const ft = floorTexture();
  ft.repeat.set((x2 - x1) / 0.8, (zS - zN) / 0.8);
  slab(g, std(0xffffff, { map: ft, roughness: 0.5 }), x1, x2, zN, zS, 0);
  slab(g, std(0xeeeeea), x1, x2, zN, zS, H, false);

  wallRun(g, wallMat, 'x', zN, x1, x2, H, 0);                                        // 北
  wallRun(g, wallMat, 'x', zS, x1, x2, H, Math.PI, [[door.x1, door.x2, door.h]]);    // 南（通走廊）
  wallRun(g, wallMat, 'z', x1, zN, zS, H, Math.PI / 2);                              // 西
  wallRun(g, panelMat, 'z', x2, zN, zS, H, -Math.PI / 2);                            // 東（木紋壁板）

  // 門洞的邊框，以及白色寵物柵欄（平常關著，開關的動作在 gate.js）
  const dx = (door.x1 + door.x2) / 2;
  box(g, 0.05, door.h, 0.2, cream, door.x1, door.h / 2, zS);
  box(g, 0.05, door.h, 0.2, cream, door.x2, door.h / 2, zS);
  box(g, door.x2 - door.x1 + 0.05, 0.05, 0.2, cream, dx, door.h + 0.025, zS);
  const gate = new THREE.Group();
  gate.position.set(door.x1 - 0.04, 0, zS - 0.12);
  for (let i = 0; i <= 8; i++) box(gate, 0.015, 0.7, 0.015, white, 0, 0.4, -i * 0.09);
  box(gate, 0.025, 0.03, 0.76, white, 0, 0.75, -0.36);
  box(gate, 0.025, 0.03, 0.76, white, 0, 0.05, -0.36);
  const gateHit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  gateHit.position.set(0, 0.42, -0.36);
  gate.add(gateHit);
  gate.name = 'kitchenGate';
  gate.userData.interact = 'gate';
  g.add(gate);

  /* ----- 北牆 ----- */
  const cD = 0.55, cH = 0.82;                       // 流理台深度與高度
  // 磁磚牆面（北牆西半、西牆北段）
  wall(g, splash, (x1 - 0.5) / 2, 0.975, zN + 0.006, -0.5 - x1, 1.95, 0);
  wall(g, splash, x1 + 0.006, 0.975, zN + 0.75, 1.5, 1.95, Math.PI / 2);

  // 轉角水槽台
  box(g, 0.7, cH, cD, cream, x1 + 0.35 + cD, cH / 2, zN + cD / 2);
  box(g, 0.5, 0.03, 0.38, steel, x1 + cD + 0.33, cH + 0.005, zN + 0.27);
  box(g, 0.42, 0.02, 0.3, std(0x6e7378, { metalness: 0.6, roughness: 0.4 }), x1 + cD + 0.33, cH + 0.022, zN + 0.27);
  cyl(g, 0.012, 0.012, 0.2, steel, x1 + cD + 0.15, cH + 0.22, zN + 0.06, 8).rotation.x = 0.5;
  // 爐台（較低、綠色檯面、下方挖空）與上方的錫箔擋板、抽油煙機、排風管
  const sx = x1 + cD + 0.7 + 0.4;
  box(g, 0.8, 0.08, cD, greenTop, sx, 0.62, zN + cD / 2);
  box(g, 0.8, 0.5, 0.04, black, sx, 0.3, zN + 0.1);
  box(g, 0.06, 0.6, cD, cream, sx - 0.37, 0.3, zN + cD / 2);
  box(g, 0.76, 0.8, 0.01, std(0xc9ccd0, { metalness: 0.5, roughness: 0.35 }), sx, 1.1, zN + 0.02);
  box(g, 0.8, 0.12, 0.5, steel, sx, 1.56, zN + 0.26);
  box(g, 0.78, 0.03, 0.52, std(0x8a8e92, { metalness: 0.6, roughness: 0.4 }), sx, 1.49, zN + 0.27);
  cyl(g, 0.08, 0.08, 0.75, std(0xd4d6d8, { metalness: 0.7, roughness: 0.35 }), sx - 0.1, 1.98, zN + 0.14, 10);
  // 右側小台（綠色檯面、黑色百葉門）
  const ex = sx + 0.4 + 0.22;
  box(g, 0.44, cH + 0.04, cD, cream, ex, (cH + 0.04) / 2, zN + cD / 2);
  box(g, 0.44, 0.02, cD, greenTop, ex, cH + 0.05, zN + cD / 2);
  box(g, 0.3, 0.6, 0.02, black, ex, 0.38, zN + cD + 0.005);
  cyl(g, 0.03, 0.03, 0.16, std(0x4a88b8), ex, cH + 0.14, zN + 0.12, 8);
  OBSTACLES.push([x1, ex + 0.22, zN, zN + cD]);

  // 後門（木門，關著）：任務二從這裡把舊尿布墊拿出去丟
  const bdx = ex + 0.22 + 0.5;
  const backDoor = new THREE.Group();
  backDoor.name = 'backDoor';
  backDoor.userData.interact = 'backdoor';
  backDoor.position.set(bdx, 0, zN);
  box(backDoor, 0.8, 2.0, 0.05, doorWood, 0, 1.08, 0.02);
  for (const y of [0.55, 1.05, 1.55]) box(backDoor, 0.5, 0.012, 0.055, std(0x8a5a2a), 0.08, y, 0.02);
  box(backDoor, 0.9, 0.08, 0.2, std(0xb9b6ae), 0, 0.04, 0.1);
  box(backDoor, 0.03, 0.14, 0.03, steel, -0.32, 1.05, 0.06);
  g.add(backDoor);

  // 鐵窗（位置較低）
  const wx = bdx + 0.4 + 0.65;
  box(g, 1.0, 0.62, 0.03, std(0x3a2a20), wx, 1.22, zN + 0.01);
  box(g, 0.92, 0.54, 0.03, std(0x16181c, { roughness: 0.2 }), wx, 1.22, zN + 0.02);
  for (let i = -3; i <= 3; i++) box(g, 0.015, 0.54, 0.02, std(0x5a3a2a), wx + i * 0.12, 1.22, zN + 0.045);
  box(g, 0.92, 0.015, 0.02, std(0x5a3a2a), wx, 1.22, zN + 0.045);

  // 冰箱（雙門、銀色）、踏板垃圾桶、拖把
  const fx = x2 - 0.65;
  box(g, 0.6, 1.5, 0.62, std(0xa9adb2, { metalness: 0.5, roughness: 0.4 }), fx, 0.75, zN + 0.4);
  box(g, 0.6, 0.012, 0.01, std(0x5c6066), fx, 1.02, zN + 0.715);
  box(g, 0.02, 0.3, 0.02, std(0x7c8086), fx - 0.26, 1.2, zN + 0.72);
  box(g, 0.02, 0.3, 0.02, std(0x7c8086), fx - 0.26, 0.8, zN + 0.72);
  OBSTACLES.push([fx - 0.32, fx + 0.32, zN, zN + 0.72]);
  cyl(g, 0.14, 0.12, 0.36, white, fx - 0.55, 0.18, zN + 0.35);
  cyl(g, 0.145, 0.145, 0.03, std(0x9fc9b4), fx - 0.55, 0.37, zN + 0.35);
  const mop = cyl(g, 0.012, 0.012, 1.25, std(0xd8d8d4), fx - 0.42, 0.65, zN + 0.12, 8);
  mop.rotation.x = 0.12;
  box(g, 0.3, 0.03, 0.1, white, fx - 0.42, 1.27, zN + 0.2);
  OBSTACLES.push([fx - 0.7, fx - 0.4, zN + 0.2, zN + 0.5]);

  /* ----- 西牆 ----- */
  // 磁磚流理台（L 形的另一邊）：黑色百葉門、檯面上的碗盤架
  box(g, cD, cH, 1.5 - cD, cream, x1 + cD / 2, cH / 2, zN + cD + (1.5 - cD) / 2);
  box(g, cD, 0.02, 1.5 - cD, greenTop, x1 + cD / 2, cH + 0.01, zN + cD + (1.5 - cD) / 2);
  box(g, 0.02, 0.6, 0.4, black, x1 + cD + 0.005, 0.36, zN + 1.2);
  box(g, 0.3, 0.3, 0.4, std(0xe8e8e4), x1 + 0.2, cH + 0.17, zN + 0.9);
  cyl(g, 0.09, 0.08, 0.08, steel, x1 + 0.3, cH + 0.06, zN + 1.3);
  // 白柱
  box(g, cD, 1.55, 0.2, white, x1 + cD / 2, 0.775, zN + 1.6);
  OBSTACLES.push([x1, x1 + cD, zN, zN + 1.7]);

  // 木紋矮櫃：白色檯面、微波爐與雜物
  const k1 = zN + 1.7, k2 = zN + 3.3, kd = 0.5, kh = 0.85, kz = (k1 + k2) / 2;
  box(g, kd, kh - 0.08, k2 - k1, oak, x1 + kd / 2, (kh - 0.08) / 2 + 0.08, kz);
  box(g, kd - 0.05, 0.08, k2 - k1, std(0xb9a583), x1 + kd / 2 - 0.02, 0.04, kz);
  box(g, kd + 0.02, 0.03, k2 - k1, std(0xeeeae0, { roughness: 0.3 }), x1 + kd / 2 + 0.01, kh + 0.015, kz);
  for (const t of [0.33, 0.66]) box(g, 0.01, kh - 0.14, 0.01, std(0xa58a60), x1 + kd + 0.004, kh / 2 + 0.03, k1 + (k2 - k1) * t);
  box(g, 0.36, 0.28, 0.48, black, x1 + 0.24, kh + 0.17, k2 - 0.32);                       // 微波爐
  box(g, 0.01, 0.2, 0.3, std(0x2a2c30, { roughness: 0.2 }), x1 + 0.425, kh + 0.17, k2 - 0.37);
  cyl(g, 0.09, 0.09, 0.09, steel, x1 + 0.25, kh + 0.075, kz + 0.05);                      // 鍋子
  box(g, 0.14, 0.07, 0.24, std(0xe2c23a), x1 + 0.3, kh + 0.065, kz - 0.25);               // 黃色盒
  box(g, 0.16, 0.12, 0.2, std(0xd0672c), x1 + 0.2, kh + 0.09, kz - 0.55);                 // 零食
  cyl(g, 0.12, 0.12, 0.015, std(0xe6ecd8), x1 + 0.3, kh + 0.04, k1 + 0.2);                // 盤子
  OBSTACLES.push([x1, x1 + kd + 0.02, k1, k2]);
  // 櫃前的紙箱
  box(g, 0.3, 0.3, 0.42, std(0xdfe3ea, { roughness: 0.9 }), x1 + kd + 0.3, 0.15, k1 + 0.25).rotation.y = 0.15;
  box(g, 0.31, 0.12, 0.43, std(0x3c63a8, { roughness: 0.9 }), x1 + kd + 0.3, 0.1, k1 + 0.25).rotation.y = 0.15;
  OBSTACLES.push([x1 + kd + 0.12, x1 + kd + 0.48, k1 + 0.02, k1 + 0.48]);

  // 白色層架（西南角）：磨豆機、綠色電鍋、黑色烤箱
  const tz = zS - 0.38, tw = 0.6, td = 0.4, th = 1.9, tx = x1 + td / 2;
  box(g, td, th, 0.02, white, tx, th / 2, tz - tw / 2);
  box(g, td, th, 0.02, white, tx, th / 2, tz + tw / 2);
  box(g, 0.02, th, tw, std(0xcfc6b4), x1 + 0.012, th / 2, tz);
  for (const y of [0.1, 0.42, 0.78, 1.08, 1.38, th - 0.01]) box(g, td, 0.02, tw, white, tx, y, tz);
  box(g, 0.02, 0.5, tw, white, x1 + td, th - 0.26, tz);                                   // 上方門板
  box(g, 0.3, 0.26, 0.44, black, tx, 0.56, tz);                                           // 烤箱
  cyl(g, 0.13, 0.13, 0.2, std(0x8fbf8a), tx, 0.89, tz + 0.05);                            // 電鍋
  cyl(g, 0.06, 0.05, 0.24, black, tx, 1.21, tz + 0.05);                                   // 磨豆機
  OBSTACLES.push([x1, x1 + td, tz - tw / 2, tz + tw / 2]);

  /* ----- 南牆：貓砂盆 ----- */
  const clear = new THREE.MeshStandardMaterial({ color: 0xe4eaee, transparent: true, opacity: 0.6, roughness: 0.3 });
  box(g, 0.3, 0.26, 0.38, clear, x1 + td + 0.28, 0.13, zS - 0.25);                        // 透明收納盒
  const lx = x1 + td + 1.0;
  box(g, 0.62, 0.3, 0.44, std(0x93b25a, { roughness: 0.7 }), lx, 0.15, zS - 0.26);        // 綠色貓砂盆
  box(g, 0.54, 0.02, 0.36, std(0xcfc8b8, { roughness: 1 }), lx, 0.3, zS - 0.26);          // 貓砂
  box(g, 0.02, 0.26, 0.07, white, lx + 0.25, 0.38, zS - 0.1);                             // 貓砂鏟
  box(g, 0.42, 0.012, 0.28, std(0xe9e2c8, { roughness: 1 }), lx + 0.1, 0.006, zS - 0.68); // 落砂墊
  OBSTACLES.push([lx - 0.32, lx + 0.32, zS - 0.5, zS]);

  /* ----- 東牆：飯碗、飼料 ----- */
  for (const z of [zN + 1.7, zN + 2.6]) {
    cyl(g, 0.17, 0.17, 0.015, std(0x6a5fb0, { roughness: 0.8 }), x2 - 0.45, 0.008, z);    // 紫色碗墊
    cyl(g, 0.1, 0.08, 0.05, steel, x2 - 0.45, 0.04, z);                                   // 不鏽鋼碗
  }
  cyl(g, 0.13, 0.11, 0.3, std(0xefe6c8), x2 - 0.2, 0.15, zS - 0.55);                      // 飼料桶
  cyl(g, 0.135, 0.135, 0.04, std(0xe09a3a), x2 - 0.2, 0.32, zS - 0.55);
  const bag = box(g, 0.3, 0.1, 0.4, std(0x3f8a52, { roughness: 0.9 }), x2 - 0.25, 0.05, zS - 0.95); // 飼料袋
  bag.rotation.y = 0.3;
  box(g, 0.012, 0.07, 0.11, white, x2 - 0.008, 1.15, zN + 1.0);                           // 插座
  box(g, 0.012, 0.11, 0.07, white, x2 - 0.008, 1.2, zS - 0.25);                           // 開關

  // 吸頂燈
  cyl(g, 0.17, 0.19, 0.07, new THREE.MeshBasicMaterial({ color: 0xffffff }), -0.3, H - 0.035, (zN + zS) / 2);

  ceilingLight(g, -0.3, H - 0.08, (zN + zS) / 2, 9);
  WALK.push([x1, x2, zN, zS], [door.x1, door.x2, zS - 0.5, zS + 0.5]);
  ROOMS.push({ name: '廚房', rect: [x1, x2, zN, zS], spot: [1.5, zS - 0.25, 0.75], center: [0, 0.9, (zN + zS) / 2], r: 8.5, theta: 2.55 });
}
