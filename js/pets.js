import * as THREE from 'three';
import { std, box } from './kit.js';

// 用方塊拼成的立體巴福柔與貓（頭朝 -z）。方塊造型和整體的像素風格一致。
// 四隻腳、頭、尾巴都是各自的關節，animatePet() 依照實際移動的速度讓牠們走起來：
// 對角的腳一起邁步、身體微微起伏搖擺、頭跟著點；停下來時狗會搖尾巴、東張西望，
// 貓停久了會把腳收起來趴成母雞蹲。

// 寵物會到處走，但場景的陰影只算一次：寵物本身不投影，改在腳下放一塊會跟著走的影子
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
function finish(g, w, l, anim) {
  g.traverse(o => { o.castShadow = false; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.scale.set(w, l, 1);
  blob.position.y = 0.006;
  blob.raycast = () => {};
  g.add(blob);
  g.userData.anim = { phase: 0, speed: 0, move: 0, sit: 0, idle: 0, eat: 0, px: null, pz: 0, seed: Math.random() * 10, ...anim };
  return g;
}
const joint = (parent, x, y, z) => {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
};

export function buildDog() {
  const d = new THREE.Group();
  const fur = std(0x1a1a1e, { roughness: 0.7 });
  const shade = std(0x2c2c33, { roughness: 0.7 });
  const body = joint(d, 0, 0, 0);                             // 身體（會起伏、搖擺）
  box(body, 0.22, 0.24, 0.62, fur, 0, 0.47, 0.15);
  box(body, 0.24, 0.27, 0.22, fur, 0, 0.49, -0.09);           // 胸
  box(body, 0.2, 0.05, 0.5, shade, 0, 0.6, 0.18);             // 背上的反光

  const head = joint(body, 0, 0.56, -0.17);                   // 頭與脖子，以肩膀為軸
  box(head, 0.15, 0.2, 0.16, fur, 0, 0.08, -0.04).rotation.x = 0.5;
  box(head, 0.2, 0.19, 0.2, fur, 0, 0.2, -0.13);
  box(head, 0.11, 0.1, 0.16, fur, 0, 0.16, -0.29);            // 吻部
  box(head, 0.05, 0.04, 0.03, std(0x050505, { roughness: 0.3 }), 0, 0.195, -0.375);   // 鼻子
  box(head, 0.05, 0.015, 0.07, std(0xe0708a), 0, 0.105, -0.33).rotation.x = 0.35;     // 舌頭
  for (const s of [-1, 1]) {
    box(head, 0.07, 0.11, 0.03, fur, s * 0.085, 0.3, -0.08).rotation.z = s * -0.35;   // 半垂的耳朵
    box(head, 0.035, 0.035, 0.01, std(0xe8e8e8), s * 0.06, 0.23, -0.232);             // 眼白
    box(head, 0.02, 0.025, 0.012, std(0x3a2414), s * 0.055, 0.228, -0.236);           // 眼珠
  }

  const legs = [];                                            // 左前、右前、左後、右後，以髖部為軸
  for (const [z, w, l] of [[-0.09, 0.07, 0.08], [0.4, 0.075, 0.09]]) for (const s of [-1, 1]) {
    const leg = joint(body, s * 0.075, 0.36, z);
    box(leg, w, 0.36, l, fur, 0, -0.18, 0);
    box(leg, w + 0.005, 0.04, l + 0.02, shade, 0, -0.34, -0.01);                      // 腳掌
    legs.push(leg);
  }

  const tail = joint(body, 0, 0.58, 0.45);                    // 翹起的尾巴
  tail.rotation.x = 0.6;
  box(tail, 0.05, 0.3, 0.05, fur, 0, 0.15, 0);

  return finish(d, 0.34, 0.8, { kind: 'dog', body, head, legs, tail, stride: 9, swing: 0.5, bob: 0.02 });
}

export function buildCat() {
  const c = new THREE.Group();
  const fur = std(0x8a735a, { roughness: 0.9 });
  const dark = std(0x3e3228, { roughness: 0.9 });
  const pale = std(0xd9cbb5, { roughness: 0.9 });
  const body = joint(c, 0, 0, 0);                             // 站著時身體離地 0.1；趴下時整個降下去
  box(body, 0.2, 0.15, 0.34, fur, 0, 0.175, 0.02);
  for (const z of [-0.06, 0.02, 0.1, 0.17]) box(body, 0.205, 0.1, 0.025, dark, 0, 0.205, z);  // 虎斑條紋
  const tuck = box(body, 0.16, 0.03, 0.08, pale, 0, 0.115, -0.17);                 // 趴下時收在胸前的前腳

  const head = joint(body, 0, 0.2, -0.14);
  box(head, 0.15, 0.13, 0.12, fur, 0, 0.07, -0.06);
  box(head, 0.07, 0.05, 0.03, pale, 0, 0.035, -0.125);        // 嘴邊
  box(head, 0.025, 0.02, 0.012, std(0xe09a90), 0, 0.055, -0.142);                  // 鼻子
  for (const s of [-1, 1]) {
    box(head, 0.045, 0.05, 0.03, fur, s * 0.05, 0.155, -0.05);                     // 耳朵
    box(head, 0.03, 0.025, 0.01, std(0xc9d23c, { roughness: 0.3 }), s * 0.04, 0.09, -0.122);  // 眼睛
    box(head, 0.01, 0.025, 0.012, std(0x050505), s * 0.04, 0.09, -0.124);
    box(head, 0.03, 0.015, 0.125, dark, s * 0.04, 0.138, -0.06);                   // 頭頂的條紋
  }

  const legs = [];
  for (const z of [-0.1, 0.13]) for (const s of [-1, 1]) {
    const leg = joint(body, s * 0.065, 0.1, z);
    box(leg, 0.05, 0.1, 0.05, fur, 0, -0.05, 0);
    box(leg, 0.052, 0.025, 0.055, pale, 0, -0.088, -0.003);                        // 白襪
    legs.push(leg);
  }

  const tail = joint(body, 0, 0.2, 0.18);                     // 走路時豎起來，趴下時捲到身邊
  box(tail, 0.04, 0.26, 0.04, dark, 0, 0.13, 0);

  return finish(c, 0.24, 0.42, { kind: 'cat', body, head, legs, tail, tuck, stride: 21, swing: 0.6, bob: 0.008 });
}

const lerp = (a, b, k) => a + (b - a) * k;

// 每一幀呼叫：從位置的變化算出移動速度，帶動走路、停下、吃飯的動作
export function animatePet(o, dt, time) {
  const a = o.userData.anim, p = o.position, size = o.scale.x;
  if (a.px === null) { a.px = p.x; a.pz = p.z; }
  const v = Math.hypot(p.x - a.px, p.z - a.pz) / Math.max(dt, 1e-3);
  a.px = p.x; a.pz = p.z;
  a.speed = lerp(a.speed, Math.min(v, 5), Math.min(1, dt * 10));
  const moving = a.speed > 0.06;
  a.move = lerp(a.move, moving ? 1 : 0, Math.min(1, dt * 8));
  a.idle = moving ? 0 : a.idle + dt;
  a.phase += dt * a.speed * a.stride / size;                  // 步伐跟著實際走的距離，腳才不會打滑
  const m = a.move, t = time + a.seed;

  // 四隻腳：對角的腳一起動（走路的步態），後腳稍微慢一點
  const swing = a.swing * m;
  const offs = [0, Math.PI, Math.PI + 0.5, 0.5];
  a.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(a.phase + offs[i]) * swing; });

  // 身體：每一步起伏兩次，左右微微搖擺
  let bodyY = Math.abs(Math.sin(a.phase)) * a.bob * m;
  a.body.rotation.z = Math.sin(a.phase) * 0.035 * m;

  // 停著時慢慢轉頭張望（兩個不同節奏疊起來，看起來才不規律）
  const look = (Math.sin(t * 0.43) * 0.5 + Math.sin(t * 1.1) * 0.25) * (1 - m);
  let headX = Math.sin(a.phase * 2) * 0.05 * m, headY = look, bodyX = 0;

  if (a.kind === 'dog') {
    // 吃飯：身體前傾、頭低到碗裡一口一口吃
    a.eat = lerp(a.eat, o.userData.eating ? 1 : 0, Math.min(1, dt * 6));
    if (a.eat > 0.01) {
      headX = lerp(headX, -1.15 - Math.abs(Math.sin(time * 7)) * 0.13, a.eat);
      headY = lerp(headY, 0, a.eat);
      bodyX = -0.2 * a.eat;
    }
    // 尾巴：走路時小幅擺動，停下來或吃飯時搖得比較開心
    a.tail.rotation.z = Math.sin(t * (moving ? 7 : 9)) * (moving ? 0.2 : 0.45);
    a.tail.rotation.x = 0.6 + Math.sin(a.phase) * 0.08 * m;

    // 互動的姿勢（play.js 設定 o.userData.pose）：握手、趴下、踹人、點穴
    const k = a.poses || (a.poses = { shake: 0, down: 0, kick: 0, poke: 0 });
    for (const name in k) k[name] = lerp(k[name], o.userData.pose === name ? 1 : 0, Math.min(1, dt * (name === 'kick' || name === 'poke' ? 14 : 6)));
    const [fl, fr, bl, br] = a.legs;
    if (k.shake > 0.01) {              // 握手：坐下（屁股著地、前腳撐直），舉起右前腳晃一晃
      const q = k.shake;
      bodyX += 0.45 * q;
      bodyY += 0.03 * q;
      fl.rotation.x = lerp(fl.rotation.x, -0.45, q);
      fr.rotation.x = lerp(fr.rotation.x, -1.75 + Math.sin(time * 9) * 0.18, q);
      bl.rotation.x = lerp(bl.rotation.x, -1.5, q);
      br.rotation.x = lerp(br.rotation.x, -1.5, q);
      headX = lerp(headX, -0.3, q);
      headY = lerp(headY, 0, q);
    }
    if (k.down > 0.01) {               // 趴下：四隻腳往前收平，肚子貼地
      const q = k.down;
      bodyY -= 0.27 * q;
      for (const leg of a.legs) leg.rotation.x = lerp(leg.rotation.x, -1.45, q);
      headX = lerp(headX, -0.15, q);
    }
    if (k.kick > 0.01) {               // 踹人：跳在半空中，身體仰起來，兩隻前腳往前踢出去，後腳往後拖
      const q = k.kick;
      bodyX += 0.55 * q;
      fl.rotation.x = lerp(fl.rotation.x, -1.9, q);
      fr.rotation.x = lerp(fr.rotation.x, -1.9, q);
      bl.rotation.x = lerp(bl.rotation.x, 0.25, q);
      br.rotation.x = lerp(br.rotation.x, 0.25, q);
      headX = lerp(headX, -0.4, q);
      headY = lerp(headY, 0, q);
    }
    if (k.poke > 0.01) {               // 點穴：用後腳立起來，右前腳往前一戳
      const q = k.poke;
      bodyX += 0.4 * q;
      bl.rotation.x = lerp(bl.rotation.x, -0.4, q);
      br.rotation.x = lerp(br.rotation.x, -0.4, q);
      fl.rotation.x = lerp(fl.rotation.x, -0.3, q);
      fr.rotation.x = lerp(fr.rotation.x, -1.85, q);
      headX = lerp(headX, -0.3, q);
      headY = lerp(headY, 0, q);
    }
  } else {
    // 貓：停超過兩秒就趴下（腳收進身體下面、尾巴捲到身邊），要走了再站起來
    a.sit = lerp(a.sit, a.idle > 2 ? 1 : 0, Math.min(1, dt * (moving ? 9 : 2.5)));
    const s = a.sit;
    bodyY -= 0.1 * s;
    for (const leg of a.legs) leg.scale.y = 1 - 0.92 * s;
    a.tuck.visible = s > 0.7;
    a.tail.position.set(0.1 * s, lerp(0.2, 0.13, s), lerp(0.18, 0.16, s));
    a.tail.rotation.x = lerp(0.45 + Math.sin(a.phase) * 0.1 * m, -Math.PI / 2, s);
    a.tail.rotation.z = Math.sin(t * 1.7) * lerp(0.18, 0.06, s);                    // 尾巴尖慢慢甩
  }
  a.body.position.y = bodyY;
  a.body.rotation.x = bodyX;
  a.head.rotation.x = headX;
  a.head.rotation.y = headY;
}
