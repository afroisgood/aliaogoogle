import * as THREE from 'three';
import { std, box } from './kit.js';

// 用方塊拼成的立體巴福柔與貓（頭朝 -z）。方塊造型和整體的像素風格一致。

export function buildDog() {
  const d = new THREE.Group();
  const fur = std(0x1a1a1e, { roughness: 0.7 });
  const shade = std(0x2c2c33, { roughness: 0.7 });
  box(d, 0.22, 0.24, 0.62, fur, 0, 0.47, 0);                 // 身體
  box(d, 0.24, 0.27, 0.22, fur, 0, 0.49, -0.24);             // 胸
  box(d, 0.2, 0.05, 0.5, shade, 0, 0.6, 0.03);               // 背上的反光
  box(d, 0.15, 0.2, 0.16, fur, 0, 0.64, -0.36).rotation.x = 0.5;   // 脖子
  box(d, 0.2, 0.19, 0.2, fur, 0, 0.76, -0.45);               // 頭
  box(d, 0.11, 0.1, 0.16, fur, 0, 0.72, -0.61);              // 吻部
  box(d, 0.05, 0.04, 0.03, std(0x050505, { roughness: 0.3 }), 0, 0.755, -0.695);  // 鼻子
  box(d, 0.05, 0.015, 0.07, std(0xe0708a), 0, 0.665, -0.65).rotation.x = 0.35;    // 舌頭
  for (const s of [-1, 1]) {
    const ear = box(d, 0.07, 0.11, 0.03, fur, s * 0.085, 0.86, -0.4);              // 半垂的耳朵
    ear.rotation.z = s * -0.35;
    box(d, 0.035, 0.035, 0.01, std(0xe8e8e8), s * 0.06, 0.79, -0.552);             // 眼白
    box(d, 0.02, 0.025, 0.012, std(0x3a2414), s * 0.055, 0.788, -0.556);           // 眼珠
    box(d, 0.07, 0.36, 0.08, fur, s * 0.075, 0.18, -0.24);                         // 前腳
    box(d, 0.075, 0.36, 0.09, fur, s * 0.075, 0.18, 0.25);                         // 後腳
    box(d, 0.075, 0.04, 0.1, shade, s * 0.075, 0.02, -0.25);                       // 腳掌
    box(d, 0.08, 0.04, 0.11, shade, s * 0.075, 0.02, 0.24);
  }
  box(d, 0.05, 0.3, 0.05, fur, 0, 0.72, 0.36).rotation.x = -0.55;                  // 翹起的尾巴
  return d;
}

export function buildCat() {
  const c = new THREE.Group();
  const fur = std(0x8a735a, { roughness: 0.9 });
  const dark = std(0x3e3228, { roughness: 0.9 });
  const pale = std(0xd9cbb5, { roughness: 0.9 });
  box(c, 0.2, 0.15, 0.34, fur, 0, 0.075, 0.02);              // 母雞蹲的身體
  for (const z of [-0.06, 0.02, 0.1, 0.17]) box(c, 0.205, 0.1, 0.025, dark, 0, 0.105, z);  // 虎斑條紋
  box(c, 0.16, 0.03, 0.08, pale, 0, 0.015, -0.17);           // 收在胸前的前腳
  box(c, 0.15, 0.13, 0.12, fur, 0, 0.17, -0.2);              // 頭
  box(c, 0.07, 0.05, 0.03, pale, 0, 0.135, -0.265);          // 嘴邊
  box(c, 0.025, 0.02, 0.012, std(0xe09a90), 0, 0.155, -0.282);                     // 鼻子
  for (const s of [-1, 1]) {
    box(c, 0.045, 0.05, 0.03, fur, s * 0.05, 0.255, -0.19);                        // 耳朵
    box(c, 0.03, 0.025, 0.01, std(0xc9d23c, { roughness: 0.3 }), s * 0.04, 0.19, -0.262);  // 眼睛
    box(c, 0.01, 0.025, 0.012, std(0x050505), s * 0.04, 0.19, -0.264);
    box(c, 0.03, 0.015, 0.125, dark, s * 0.04, 0.238, -0.2);                       // 頭頂的條紋
  }
  box(c, 0.04, 0.04, 0.26, dark, 0.12, 0.02, 0.08);          // 捲在身邊的尾巴
  return c;
}
