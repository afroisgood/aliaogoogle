import * as THREE from 'three';

// 各房間共用的建模工具：點陣貼圖、方塊、單面牆、立牌

// 畫面風格。預設為 pixel（精緻像素）；網址加上 ?style=retro / toon / soft 可切換成其他風格
const STYLES = {
  // 最初的復古 FPS 風格：低解析度加網點
  retro: { h: 240, levels: 7, dither: 1, pixel: true, fog: [2.5, 13], ambient: 2.1, spot: 1.6 },
  // 「精緻像素」：解析度加倍、不用網點，保留點陣貼圖，加上陰影
  pixel: { h: 480, levels: 24, dither: 0, pixel: true, shadows: true, fog: [5, 26], ambient: 1.35, spot: 3.2 },
  // 「卡通描邊」：全解析度、色塊上色加墨線
  toon: { h: 0, levels: 0, dither: 0, toon: true, outline: 1, shadows: true, ambient: 1.9, spot: 2.2 },
  // 「柔光模型屋」：全解析度、柔和陰影與暖色調
  soft: { h: 0, levels: 0, dither: 0, tonemap: 1, shadows: true, ambient: 1.5, spot: 5.0 },
};
const styleName = new URLSearchParams(location.search).get('style');

// 牆面與燈光的色調。網址加上 ?warm=a / b / c 可試看
const WARMS = {
  now: { wall: [50, 28, 86], light: 0xfff0d8, sky: 0xffffff, ground: 0xb0a890, boost: 1 },
  a: { wall: [44, 48, 88], light: 0xffe6bc, sky: 0xfff6e4, ground: 0xd6c4a0, boost: 1.2 },   // 奶油白
  b: { wall: [39, 62, 83], light: 0xffdba0, sky: 0xfff0d0, ground: 0xdcc090, boost: 1.2 },   // 蜂蜜黃
  c: { wall: [26, 55, 86], light: 0xffdfc6, sky: 0xfff0e6, ground: 0xdcbca6, boost: 1.2 },   // 蜜桃粉
};
export const WARM = WARMS[new URLSearchParams(location.search).get('warm')] || WARMS.now;

export const STYLE = { name: STYLES[styleName] ? styleName : 'pixel', ...(STYLES[styleName] || STYLES.pixel) };

// 第一人稱視角的碰撞方塊 [x1, x2, z1, z2]
export const OBSTACLES = [];

/* ---------- 貼圖 ---------- */

export function pixelTexture(c) {
  if (!STYLE.pixel) {
    // 平滑風格：把點陣圖放大成清楚的大圖，再用一般的平滑取樣
    const big = document.createElement('canvas');
    big.width = c.width * 8; big.height = c.height * 8;
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(c, 0, 0, big.width, big.height);
    c = big;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  if (STYLE.pixel) {
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
  } else {
    t.anisotropy = 8;
  }
  return t;
}

// 低解析度點陣貼圖（復古 FPS 風格）
export function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return pixelTexture(c);
}

// 逐像素雜訊
export function speckle(g, s, base, spread) {
  if (!STYLE.pixel) spread *= 0.3;      // 平滑風格的顆粒感要淡一點
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const [h, sat, l] = base;
    g.fillStyle = `hsl(${h}, ${sat}%, ${l + (Math.random() - 0.5) * spread}%)`;
    g.fillRect(x, y, 1, 1);
  }
}

// 米色地磚，交丁鋪法；一張貼圖 = 0.6m x 0.6m
export function tileTexture() {
  return canvasTexture(32, (g, s) => {
    speckle(g, s, [42, 42, 74], 9);
    g.fillStyle = '#7d6d4c';
    const t = s / 2;
    g.fillRect(0, 0, s, 1); g.fillRect(0, t, s, 1);
    g.fillRect(0, 0, 1, t); g.fillRect(t, 0, 1, t);
    g.fillRect(t / 2, t, 1, t); g.fillRect(t * 1.5, t, 1, t);
  });
}

export function woodTexture(base, dark, planks = 1) {
  return canvasTexture(32, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    g.fillStyle = dark;
    for (let x = 0; x < s; x++) {
      g.globalAlpha = Math.random() * 0.22;
      g.fillRect(x, 0, 1, s);
      for (let k = 0; k < 3; k++) { g.globalAlpha = 0.12; g.fillRect(x, Math.floor(Math.random() * s), 1, 3); }
    }
    g.globalAlpha = 0.7;
    for (let i = 0; i < planks; i++) g.fillRect(Math.round((i * s) / planks), 0, 1, s);
    g.globalAlpha = 1;
  });
}

// 牆面：帶顆粒的米白漆
export function wallTexture() {
  return canvasTexture(32, (g, s) => speckle(g, s, WARM.wall, 7));
}

/* ---------- 小工具 ---------- */

export const std = (color, o = {}) => {
  if (!STYLE.toon) return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const { roughness, metalness, ...rest } = o;
  return new THREE.MeshToonMaterial({ color, ...rest });
};

export function box(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// 單面牆：只從室內看得到，俯瞰時不會擋住視線
export function wall(parent, mat, cx, cy, cz, w, h, rotY) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;                       // 貼圖每 0.8m 重複一次
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 0.8, uv.getY(i) * h / 0.8);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, cy, cz);
  m.rotation.y = rotY;
  m.receiveShadow = true;
  m.castShadow = true;            // 牆會擋光，燈光才不會漏到隔壁房間
  mat.shadowSide = THREE.DoubleSide;
  parent.add(m);
  return m;
}

export function cyl(parent, r1, r2, h, mat, x, y, z, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function ball(parent, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/* ---------- 巴福柔與貓 ---------- */

// 點陣圖立牌：永遠面向鏡頭，底部貼地
export function sprite(canvas, height) {
  const mat = new THREE.SpriteMaterial({ map: pixelTexture(canvas), alphaTest: 0.5 });
  const sp = new THREE.Sprite(mat);
  sp.center.set(0.5, 0);
  sp.scale.set(height * canvas.width / canvas.height, height, 1);
  return sp;
}


// 沿一條直線蓋牆，可留門洞。axis 'x'：牆沿 x 方向、固定 z；axis 'z'：牆沿 z 方向、固定 x
// doors: [[起, 迄, 門高], ...]
export function wallRun(parent, mat, axis, fixed, a, b, h, rotY, doors = []) {
  const seg = (s, e, y1, y2) => {
    if (e - s < 0.001) return;
    const mid = (s + e) / 2, cy = (y1 + y2) / 2;
    if (axis === 'x') wall(parent, mat, mid, cy, fixed, e - s, y2 - y1, rotY);
    else wall(parent, mat, fixed, cy, mid, e - s, y2 - y1, rotY);
  };
  let cur = a;
  for (const [d1, d2, dh] of [...doors].sort((p, q) => p[0] - q[0])) {
    seg(cur, d1, 0, h);
    seg(d1, d2, dh, h);
    cur = d2;
  }
  seg(cur, b, 0, h);
}

// 水平面（地板朝上、天花板朝下）
export function slab(parent, mat, x1, x2, z1, z2, y, up = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat);
  m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2;
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// 可行走範圍 [x1, x2, z1, z2]；房間與門洞各一塊，門洞要往兩側各多伸出一些
export const WALK = [];
// 房間名稱與範圍，用來顯示目前所在位置
export const ROOMS = [];

// 吸頂燈的光：往下照的聚光燈，reach 是照得到的距離（公尺）
export function ceilingLight(parent, x, y, z, reach = 8, mapSize = 1024, power = 1) {
  const spot = new THREE.SpotLight(WARM.light, STYLE.spot * power, reach, 1.3, 0.6, 0);
  spot.position.set(x, y, z);
  spot.target.position.set(x, 0, z);
  if (STYLE.shadows) {
    spot.castShadow = true;
    spot.shadow.mapSize.set(mapSize, mapSize);
    spot.shadow.camera.near = 0.1;
    spot.shadow.camera.far = reach;
    spot.shadow.bias = -0.003;
    spot.shadow.normalBias = 0.03;
    spot.shadow.radius = STYLE.pixel ? 1 : 6;
  }
  parent.add(spot, spot.target);
  return spot;
}
