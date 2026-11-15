import * as THREE from 'three';
import { STYLE, SPACE, ROOMS, canvasTexture, speckle, std } from './kit.js';

// 屋子外面的樣子：
// - 俯瞰：暖色的背景，屋子放在一塊草皮底座上（上面草綠、側面木頭色），像桌上的模型屋
// - 人／狗／貓的視角：遠處漸漸融進暖色的霧（不是變黑），窗外和門外也是同一個顏色
// 要在 relayout() 之後呼叫（地面的大小照屋子實際的範圍）。回傳 setView(name)，切換視角時呼叫。
const SKY = '#f3e3cd';                 // 俯瞰背景：奶油色（漸層在像素風格裡會分成一圈圈色帶，所以用純色）
const FOG = STYLE.fogColor || '#d4b49b';

export function initBackdrop(scene) {
  const sky = new THREE.Color(SKY);

  /* ----- 模型底座：屋子範圍往外多留一圈，厚一點，看得到側面 ----- */
  const rects = ROOMS.map(r => r.rect);
  const x1 = Math.min(...rects.map(r => r[0])), x2 = Math.max(...rects.map(r => r[1]));
  const z1 = Math.min(...rects.map(r => r[2])), z2 = Math.max(...rects.map(r => r[3]));
  const pad = 0.7 * SPACE, H = 0.3, w = x2 - x1 + pad * 2, d = z2 - z1 + pad * 2;
  const grass = canvasTexture(16, (g, s) => speckle(g, s, [82, 26, 64], 8));
  grass.repeat.set(w / 1.2, d / 1.2);
  const side = std(0x8a5f3c, { roughness: 1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, H, d),
    [side, side, std(0xffffff, { map: grass, roughness: 1 }), side, side, side]);
  base.position.set((x1 + x2) / 2, -0.01 - H / 2, (z1 + z2) / 2);
  base.raycast = () => {};
  scene.add(base);

  /* ----- 第一人稱的暖色霧 ----- */
  const fogColor = new THREE.Color(FOG);
  const fog = STYLE.fog ? new THREE.Fog(fogColor, ...STYLE.fog.map(m => m * SPACE)) : null;

  return function setView(name) {
    const top = name === 'overview';
    scene.background = top ? sky : fogColor;
    scene.fog = top ? null : fog;
    base.visible = top;
  };
}
