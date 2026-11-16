import { SPACE, WALK, ROOMS, OBSTACLES } from './kit.js';
import { KITCHEN } from './kitchen.js';
import { gridCanvas } from './pixelart.js';
import { play, buzz } from './sound.js';

// 小遊戲「巴福柔追貓」：2D 俯瞰。玩家是貓，把屋裡的小魚乾撿完就過關；巴福柔一直追，被追到就結束。
// 貓鑽得過廚房柵欄，巴福柔過不去（會在門口等，等太久會睡著，貓可以趁機溜出去）。
// 每一關小魚乾變多、巴福柔跑更快。
//
// 地圖直接用屋子的資料（kit.js 的 WALK 可走範圍、OBSTACLES 家具、ROOMS 房間），和 3D 版的格局一致。
// 移動在 0.3 公尺的格子上：貓照玩家的方向一格一格走（可以先按好下一個轉彎），巴福柔每走到一格就重新找路追貓。
//   initChase() 回傳 { open(), isOpen() }
const CELL = 0.3;                // 一格幾公尺
const PX = 6;                    // 一格在畫面上幾個像素（之後整個畫面再放大成像素風）
const PPM = PX / CELL;           // 每公尺幾個像素
const MARGIN = 0.12;             // 格子中心離牆、離家具至少多遠才算走得過去
const CAT_SPEED = 5.5;           // 格／秒
const BEST_KEY = 'aliao-chase-best';
const DOZE = 3;                  // 巴福柔在柵欄外等幾秒會睡著
const NAP = 4.5;                 // 睡幾秒
const WAKE = 0.5;                // 醒來後愣住幾秒才開始追

/* ---------- 像素圖（頭朝上） ---------- */

const CAT = gridCanvas([
  '.t...t.',
  'tt...tt',
  'ttttttt',
  'tdtttdt',
  '.ttttt.',
  '.tdddt.',
  '.ttttt.',
  '.tdddt.',
  '..ttt..',
  '...d...',
  '...d...',
], { t: '#a8865f', d: '#4a3a2c' });

const DOG = gridCanvas([
  '...kkk...',
  '..kkkkk..',
  '.gkkkkkg.',
  'gkkkkkkkg',
  '..rrrrr..',
  '.kkkkkkk.',
  'kkgkkkgkk',
  'kkkkkkkkk',
  'kkkkkkkkk',
  'kkkkkkkkk',
  '.kkkkkkk.',
  '.k.....k.',
  '....k....',
  '....k....',
], { k: '#17171b', g: '#4a4a56', r: '#d8452c' });

// 睡著的巴福柔：捲成一團（頭朝上、尾巴繞到旁邊）
const DOG_NAP = gridCanvas([
  '..k...k..',
  '.kkkkkkk.',
  'kkkkkkkkk',
  'kkgkkkgkk',
  'kkkrrrkkk',
  'kkkkkkkkk',
  'kkkkkkkkk',
  '.kkkkkkkk',
  '..kkkkk.k',
  '.......k.',
], { k: '#17171b', g: '#4a4a56', r: '#d8452c' });

const FISH = gridCanvas([
  '.ooo.o',
  'owooo.',
  '.ooo.o',
], { o: '#f0a040', w: '#2a2420' });

// 地板顏色（照 3D 版的地板）：[底色, 格線]
const FLOORS = {
  客廳: ['#ead2a4', '#d9bc8a'], 走廊: ['#ead2a4', '#d9bc8a'],
  狗房: ['#62666e', '#52565d'], 廁所: ['#80858c', '#6e737a'], 廚房: ['#555961', '#474a51'],
};

export function initChase() {
  const root = document.getElementById('chase');
  let built = null, running = false, raf = 0;

  /* ---------- 地圖：開第一次時才建（屋子已經換算成實際大小） ---------- */
  function build() {
    const { door, zS } = KITCHEN;
    const gate = [door.x1 * SPACE, door.x2 * SPACE, (zS - 0.1) * SPACE, (zS + 0.02) * SPACE];
    const isGate = r => Math.abs(r[0] - gate[0]) < 0.01 && Math.abs(r[2] - gate[2]) < 0.01;
    // 家具（柵欄另外處理：不管 3D 裡開著還是關著，這裡貓過得去、狗過不去）
    const furniture = OBSTACLES.filter(r => r[0] < 50 && !isGate(r)).map(r => r.slice(0, 4));

    const x0 = Math.min(...WALK.map(w => w[0])) - CELL, x1 = Math.max(...WALK.map(w => w[1])) + CELL;
    const z0 = Math.min(...WALK.map(w => w[2])) - CELL, z1 = Math.max(...WALK.map(w => w[3])) + CELL;
    const nx = Math.ceil((x1 - x0) / CELL), nz = Math.ceil((z1 - z0) / CELL);
    const cx = i => x0 + (i + 0.5) * CELL, cz = j => z0 + (j + 0.5) * CELL;
    const inside = (x, z, r) => x > r[0] - MARGIN && x < r[1] + MARGIN && z > r[2] - MARGIN && z < r[3] + MARGIN;
    const onFloor = (x, z) => WALK.some(w => x >= w[0] + MARGIN && x <= w[1] - MARGIN && z >= w[2] + MARGIN && z <= w[3] - MARGIN);
    const catOK = new Uint8Array(nx * nz), dogOK = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = cx(i), z = cz(j);
      const ok = onFloor(x, z) && !furniture.some(r => inside(x, z, r));
      catOK[i + j * nx] = ok ? 1 : 0;
      dogOK[i + j * nx] = ok && !inside(x, z, gate) ? 1 : 0;
    }
    // 離某個點最近、走得到的格子
    const nearest = (x, z, okGrid) => {
      let best = -1, bd = Infinity;
      for (let k = 0; k < okGrid.length; k++) {
        if (!okGrid[k]) continue;
        const d = Math.hypot(cx(k % nx) - x, cz(Math.floor(k / nx)) - z);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    const catStart = nearest(0.2 * SPACE, 1.0 * SPACE, catOK);        // 客廳中間
    const dogStart = nearest(-0.6 * SPACE, -9.5 * SPACE, dogOK);      // 狗房

    /* ----- 預先畫好整張地圖 ----- */
    const map = document.createElement('canvas');
    map.width = Math.ceil((x1 - x0) * PPM); map.height = Math.ceil((z1 - z0) * PPM);
    const g = map.getContext('2d');
    const R = ([a, b, c, d]) => [Math.round((a - x0) * PPM), Math.round((c - z0) * PPM), Math.round((b - a) * PPM), Math.round((d - c) * PPM)];
    g.fillStyle = '#8fa070';                                          // 屋外：草地
    g.fillRect(0, 0, map.width, map.height);
    g.fillStyle = '#7e8f62';
    for (let y = 0; y < map.height; y += 4) for (let x = (y / 4) % 2 * 2; x < map.width; x += 4) g.fillRect(x, y, 1, 1);
    // 屋子範圍內（含還沒做進來的房間）先塗黑
    g.fillStyle = '#141210';
    const hx0 = Math.min(...ROOMS.map(r => r.rect[0])), hx1 = Math.max(...ROOMS.map(r => r.rect[1]));
    const hz0 = Math.min(...ROOMS.map(r => r.rect[2])), hz1 = Math.max(...ROOMS.map(r => r.rect[3]));
    g.fillRect(...R([hx0 - 0.1, hx1 + 0.1, hz0 - 0.1, hz1 + 0.1]));
    // 地板 → 牆（沿著每個房間的四邊）→ 門洞（把牆挖開，填上兩邊房間的地板色）
    for (const { rect, name } of ROOMS) {
      const [fill, line] = FLOORS[name] || FLOORS.客廳;
      const [x, y, w, h] = R(rect);
      g.fillStyle = fill;
      g.fillRect(x, y, w, h);
      g.fillStyle = line;                                             // 地磚格線，每 0.6 公尺
      const step = Math.round(0.6 * PPM);
      for (let px = x + step; px < x + w; px += step) g.fillRect(px, y, 1, h);
      for (let py = y + step; py < y + h; py += step) g.fillRect(x, py, w, 1);
    }
    const ww = 0.1;                                                   // 牆厚的一半
    g.fillStyle = '#6b4a30';
    for (const { rect: [a, b, c, d] } of ROOMS) {
      for (const r of [[a - ww, b + ww, c - ww, c + ww], [a - ww, b + ww, d - ww, d + ww], [a - ww, a + ww, c - ww, d + ww], [b - ww, b + ww, c - ww, d + ww]]) g.fillRect(...R(r));
    }
    const within = (w, r) => r[0] <= w[0] + 0.01 && r[1] >= w[1] - 0.01 && r[2] <= w[2] + 0.01 && r[3] >= w[3] - 0.01;
    for (const w of WALK) {
      if (ROOMS.some(({ rect }) => within(w, rect))) continue;        // 房間本身，不是門洞
      for (const { rect: [a, b, c, d], name } of ROOMS) {
        const r = [Math.max(w[0], a - ww), Math.min(w[1], b + ww), Math.max(w[2], c - ww), Math.min(w[3], d + ww)];
        if (r[1] <= r[0] || r[3] <= r[2]) continue;
        g.fillStyle = (FLOORS[name] || FLOORS.客廳)[0];
        g.fillRect(...R(r));
      }
    }
    // 家具：木頭色方塊，上緣亮、下緣暗，看起來有高度
    for (const r of furniture) {
      const [x, y, w, h] = R(r);
      g.fillStyle = '#4a3322'; g.fillRect(x, y + 1, w, h);
      g.fillStyle = '#a77a4f'; g.fillRect(x, y, w, h - 1);
      g.fillStyle = '#c99a68'; g.fillRect(x, y, w, 1);
    }
    // 廚房柵欄：白色欄杆（貓鑽得過去）
    {
      const [x, y, w, h] = R(gate);
      g.fillStyle = '#f4f4f2';
      for (let px = x; px < x + w; px += 2) g.fillRect(px, y, 1, Math.max(2, h));
    }
    return { nx, nz, x0, z0, catOK, dogOK, catStart, dogStart, map };   // dogReach 在下面算好（要用到 distances）
  }

  /* ---------- 遊戲狀態 ---------- */
  const best = () => +localStorage.getItem(BEST_KEY) || 0;
  let S = null;            // 這一局：{ level, score, cat, dog, fish, left, phase, ... }

  const cell = k => [k % built.nx, Math.floor(k / built.nx)];
  const idx = (i, j) => (i < 0 || j < 0 || i >= built.nx || j >= built.nz ? -1 : i + j * built.nx);
  const ok = (grid, i, j) => { const k = idx(i, j); return k >= 0 && grid[k] === 1; };

  // 從某一格出發，所有走得到的格子的步數（-1 表示走不到）
  function distances(grid, from) {
    const d = new Int16Array(grid.length).fill(-1);
    d[from] = 0;
    const q = [from];
    for (let h = 0; h < q.length; h++) {
      const [i, j] = cell(q[h]);
      for (const [di, dj] of DIRS) {
        const k = idx(i + di, j + dj);
        if (k >= 0 && grid[k] && d[k] < 0) { d[k] = d[q[h]] + 1; q.push(k); }
      }
    }
    return d;
  }
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function newLevel(level, score) {
    const fishCount = Math.min(10 + level * 4, 34);
    const fromCat = distances(built.catOK, built.catStart);
    const [dsi, dsj] = cell(built.dogStart);
    // 小魚乾：貓走得到的格子裡隨機挑，彼此隔開、離起點遠一點
    const spots = [];
    const pool = [...fromCat.keys()].filter(k => fromCat[k] >= 3).sort(() => Math.random() - 0.5);
    for (const k of pool) {
      if (spots.length >= fishCount) break;
      const [i, j] = cell(k);
      if (Math.abs(i - dsi) + Math.abs(j - dsj) < 6) continue;
      if (spots.some(s => Math.abs(s[0] - i) + Math.abs(s[1] - j) < 4)) continue;
      spots.push([i, j]);
    }
    const [ci, cj] = cell(built.catStart);
    const [di, dj] = cell(built.dogStart);
    S = {
      level, score, phase: 'ready', t: 0,
      cat: { i: ci, j: cj, x: ci, y: cj, dir: [0, 0], want: [0, 0], face: 0 },
      dog: { i: di, j: dj, x: di, y: dj, dir: [0, 0], face: 0, speed: Math.min(4.1 + (level - 1) * 0.3, 5.6), sniff: 0, bark: 2,
        wait: 0, nap: 0, wake: 0 },     // wait：在柵欄外等了幾秒；nap：還要睡幾秒；wake：醒來後還要愣幾秒
      fish: spots, total: spots.length,
    };
    render();
  }

  /* ---------- 移動 ---------- */

  // 讓角色往 dir 前進：走到格子中心時決定下一步（choose 回傳新的方向，[0,0] 表示停下）
  function step(a, speed, dt, choose) {
    let move = speed * dt;
    while (move > 0) {
      const [dx, dy] = a.dir;
      if (!dx && !dy) {                                    // 停著：看看能不能出發
        a.dir = choose(a);
        if (!a.dir[0] && !a.dir[1]) return;
        continue;
      }
      const tx = a.i + dx, ty = a.j + dy;                  // 正在走向的格子
      const left = Math.abs(tx - a.x) + Math.abs(ty - a.y);
      if (move < left) { a.x += dx * move; a.y += dy * move; return; }
      a.x = a.i = tx; a.y = a.j = ty;
      move -= left;
      a.dir = choose(a);
    }
  }

  // 貓：照玩家想走的方向；那邊不通就沿原方向繼續，也不通就停
  const catChoose = a => {
    const { want, dir } = a;
    if ((want[0] || want[1]) && ok(built.catOK, a.i + want[0], a.j + want[1])) return want;
    if ((dir[0] || dir[1]) && ok(built.catOK, a.i + dir[0], a.j + dir[1])) return dir;
    return [0, 0];
  };

  // 巴福柔：找一條路追到貓；貓躲在牠到不了的地方（廚房），就到「貓要走最少步才到得了」的地方等著——
  // 也就是柵欄門口，而不是隔著牆離貓最近的地方
  const dogChoose = a => {
    const { cat } = S;
    if (Math.random() < 0.035) { a.sniff = 0.9; return [0, 0]; }      // 偶爾停下來聞一聞
    const here = idx(a.i, a.j);
    const d = distances(built.dogOK, here);
    let goal = idx(cat.i, cat.j);
    if (goal < 0 || d[goal] < 0) {
      const fromCat = distances(built.catOK, idx(cat.i, cat.j));
      let bd = Infinity;
      for (let k = 0; k < d.length; k++) if (d[k] >= 0 && fromCat[k] >= 0 && fromCat[k] < bd) { bd = fromCat[k]; goal = k; }
    }
    if (goal === here) return [0, 0];
    // 從目標往回找：哪一個相鄰格子離目標最近
    const back = distances(built.dogOK, goal);
    let bestDir = [0, 0], bd = back[here];
    for (const dir of DIRS) {
      const k = idx(a.i + dir[0], a.j + dir[1]);
      if (k >= 0 && back[k] >= 0 && back[k] < bd) { bd = back[k]; bestDir = dir; }
    }
    return bestDir;
  };

  const faceOf = ([dx, dy], was) => (dx || dy ? Math.atan2(dx, -dy) : was);

  function update(dt) {
    if (S.phase === 'ready') {
      if ((S.t += dt) > 1.2) S.phase = 'play';
      return;
    }
    if (S.phase !== 'play') return;
    const { cat, dog } = S;
    // 走到一半想回頭：馬上掉頭，不用等走到格子中心
    if (cat.want[0] === -cat.dir[0] && cat.want[1] === -cat.dir[1] && (cat.dir[0] || cat.dir[1])) {
      cat.i += cat.dir[0]; cat.j += cat.dir[1];
      cat.dir = cat.want;
    }
    step(cat, CAT_SPEED, dt, catChoose);
    cat.face = faceOf(cat.dir, cat.face);
    // 撿小魚乾
    const got = S.fish.findIndex(([i, j]) => Math.abs(i - cat.x) + Math.abs(j - cat.y) < 0.6);
    if (got >= 0) {
      S.fish.splice(got, 1);
      S.score += 10;
      play('pick');
      if (!S.fish.length) return levelClear();
    }
    // 巴福柔：睡著 → 醒來愣一下 → 追
    if (dog.nap > 0) {
      if ((dog.nap -= dt) <= 0) { dog.wake = WAKE; play('woof'); }
      return;                                             // 睡著時抓不到貓
    }
    if (dog.wake > 0) { dog.wake -= dt; return; }
    if (dog.sniff > 0) dog.sniff -= dt;
    else {
      step(dog, dog.speed, dt, dogChoose);
      dog.face = faceOf(dog.dir, dog.face);
    }
    // 貓躲在牠到不了的地方（廚房）、牠在門口停著等：等太久就睡著
    const hiding = built.dogReach[idx(cat.i, cat.j)] < 0;
    const idle = !dog.dir[0] && !dog.dir[1];
    dog.wait = hiding && idle ? dog.wait + dt : 0;
    if (dog.wait > DOZE) {
      Object.assign(dog, { wait: 0, nap: NAP, sniff: 0 });
      play('snore');
      return;
    }
    const dist = Math.hypot(dog.x - cat.x, dog.y - cat.y);
    if ((dog.bark -= dt) <= 0 && dist < 6) { play('woof'); dog.bark = 3 + Math.random() * 3; }
    if (dist < 0.9) caught();
  }

  function levelClear() {
    S.phase = 'clear';
    S.score += 50 * S.level;
    play('done');
    buzz([60, 40, 120]);
    render();
    setTimeout(() => { if (running && S.phase === 'clear') newLevel(S.level + 1, S.score); }, 1800);
  }

  function caught() {
    S.phase = 'over';
    play('hit');
    setTimeout(() => play('woof2'), 250);
    buzz([150, 60, 150]);
    S.record = S.score > best();
    if (S.record) localStorage.setItem(BEST_KEY, String(S.score));
    render();
  }

  /* ---------- 畫面 ---------- */
  let canvas, ctx, scale = 3;

  // 放大倍率：手機（直式）讓地圖寬度剛好填滿螢幕、上下跟著貓捲動；電腦（橫式）看得到大約 220 像素高
  function resize() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    scale = Math.max(2, Math.min(6, W / (built.map.width + 6), H / 220));
    canvas.width = Math.ceil(W / scale);
    canvas.height = Math.ceil(H / scale);
    ctx.imageSmoothingEnabled = false;
  }

  function sprite(img, x, y, angle) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(Math.round(angle / (Math.PI / 2)) * (Math.PI / 2));    // 只轉 90 度的倍數，像素才不會歪
    ctx.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2));
    ctx.restore();
  }

  function draw(time) {
    const { map } = built, vw = canvas.width, vh = canvas.height;
    const { cat, dog } = S;
    const px = c => (c + 0.5) * PX;
    // 鏡頭：地圖比畫面窄就置中，比畫面長就跟著貓
    const ox = map.width <= vw ? Math.floor((vw - map.width) / 2) : Math.round(Math.min(0, Math.max(vw - map.width, vw / 2 - px(cat.x))));
    const oy = map.height <= vh ? Math.floor((vh - map.height) / 2) : Math.round(Math.min(0, Math.max(vh - map.height, vh / 2 - px(cat.y))));
    ctx.fillStyle = '#8fa070';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(map, ox, oy);
    // 小魚乾（上下輕輕跳）
    S.fish.forEach(([i, j], n) => ctx.drawImage(FISH, ox + px(i) - 3, oy + px(j) - 1 + Math.round(Math.sin(time * 5 + n) * 0.6)));
    // 影子＋角色
    const shadow = (x, y, w) => { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y + 3), w, 2); };
    const bob = a => (a.dir[0] || a.dir[1] ? Math.round(Math.abs(Math.sin(time * 14))) : 0);
    shadow(ox + px(cat.x), oy + px(cat.y), 6);
    sprite(CAT, ox + px(cat.x), oy + px(cat.y) - bob(cat), cat.face);
    shadow(ox + px(dog.x), oy + px(dog.y), 9);
    sprite(dog.nap > 0 ? DOG_NAP : DOG, ox + px(dog.x), oy + px(dog.y) - bob(dog), dog.face);
    // 頭上的符號：聞地板「？」、睡著「Zzz」往上飄、剛醒來「！」
    ctx.font = '8px "Cubic 11", sans-serif';
    const hx = ox + px(dog.x) + 4, hy = oy + px(dog.y) - 6;
    if (dog.nap > 0) {
      ctx.fillStyle = '#e8f0ff';
      for (let n = 0; n < 3; n++) {
        const k = (time * 0.8 + n / 3) % 1;                          // 每個 z 從頭上往右上飄、慢慢變淡
        ctx.globalAlpha = 1 - k;
        ctx.fillText('z', Math.round(hx + k * 6), Math.round(hy - k * 10));
      }
      ctx.globalAlpha = 1;
    } else if (dog.wake > 0) {
      ctx.fillStyle = '#ff6a3c';
      ctx.fillText('!', hx, hy);
    } else if (dog.sniff > 0) {
      ctx.fillStyle = '#ffd23c';
      ctx.fillText('?', hx, hy);
    }
    // 巴福柔在畫面外：邊緣出現紅色箭頭指著牠的方向
    const dxs = ox + px(dog.x), dys = oy + px(dog.y);
    if (dxs < 0 || dys < 0 || dxs > vw || dys > vh) {
      const ex = Math.max(6, Math.min(vw - 6, dxs)), ey = Math.max(6, Math.min(vh - 6, dys));
      const a = Math.atan2(dys - ey, dxs - ex);
      ctx.save();
      ctx.translate(Math.round(ex), Math.round(ey));
      ctx.rotate(a);
      ctx.fillStyle = '#d8281c';
      for (let k = 0; k < 4; k++) ctx.fillRect(-k, -k, 1, k * 2 + 1);        // 像素三角形
      ctx.restore();
    }
    // 巴福柔靠近時，畫面四周泛紅
    const near = Math.hypot(dog.x - cat.x, dog.y - cat.y);
    if (S.phase === 'play' && near < 5 && dog.nap <= 0) {
      ctx.fillStyle = `rgba(200,30,20,${(0.22 * (1 - near / 5)).toFixed(3)})`;
      ctx.fillRect(0, 0, vw, 3); ctx.fillRect(0, vh - 3, vw, 3); ctx.fillRect(0, 0, 3, vh); ctx.fillRect(vw - 3, 0, 3, vh);
    }
  }

  /* ---------- 介面：上方資訊列、開始／過關／結束卡片 ---------- */
  let hudText = '';
  function renderHud() {
    const html = !S || S.phase === 'title' ? `<span>最高 ${best()}</span>`
      : `<span>第 ${S.level} 關</span><span>小魚乾 ${S.total - S.fish.length}/${S.total}</span><span>分數 ${S.score}</span><span>最高 ${best()}</span>`;
    if (html !== hudText) root.querySelector('.chase-hud').innerHTML = hudText = html;
  }
  function render() {
    renderHud();
    const title = !S || S.phase === 'title';
    const card = root.querySelector('.chase-card');
    const show = (html, buttons = []) => {
      card.innerHTML = `<div class="card-body">${html}<div class="card-actions">${
        buttons.map((b, i) => `<button data-i="${i}" class="${i ? '' : 'primary'}">${b[0]}</button>`).join('')}</div></div>`;
      card.querySelectorAll('[data-i]').forEach(el => el.onclick = buttons[+el.dataset.i][1]);
      card.classList.remove('banner');
      card.hidden = false;
    };
    const banner = text => {
      card.innerHTML = `<div class="chase-banner">${text}</div>`;
      card.classList.add('banner');                                   // 橫幅不擋操作
      card.hidden = false;
    };
    if (title) {
      show(`<h2>巴福柔追貓</h2>
        <p>你是貓。把屋裡的小魚乾全部撿完就過關。</p>
        <p>巴福柔會一直追你，被追到就結束。</p>
        <p>貓鑽得過<b>廚房柵欄</b>，巴福柔過不去。牠在門口等太久會<b>睡著</b>，趁牠睡覺溜出去！</p>
        <p class="card-tag">操作：手指在畫面上滑動改變方向；電腦用方向鍵或 WASD</p>`,
      [['開始', () => newLevel(1, 0)], ['離開', close]]);
    } else if (S.phase === 'ready') banner(`第 ${S.level} 關　準備！`);
    else if (S.phase === 'clear') banner(`第 ${S.level} 關過關！　＋${50 * S.level}`);
    else if (S.phase === 'over') {
      show(`<h2>被巴福柔抓到了！</h2>
        <p>走到第 ${S.level} 關，分數 <b>${S.score}</b>${S.record ? '　🎉 新紀錄！' : `（最高 ${best()}）`}</p>`,
      [['再玩一次', () => newLevel(1, 0)], ['離開', close]]);
    } else card.hidden = true;
  }

  let lastPhase = '';
  let last = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    if (S) {
      update(dt);
      if (S.phase !== lastPhase) { lastPhase = S.phase; render(); }
      else if (S.phase === 'play') renderHud();
      draw(now / 1000);
    }
    raf = requestAnimationFrame(loop);
  }

  /* ---------- 操作：滑動、點一下、方向鍵 ---------- */
  const setWant = (dx, dy) => { if (S && S.phase !== 'over') S.cat.want = [dx, dy]; };
  function onKey(e) {
    if (!running) return;
    const k = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] }[e.code];
    if (k) { e.preventDefault(); e.stopPropagation(); setWant(...k); }
    if (e.code === 'Escape') close();
  }
  let touch = null;
  function onDown(e) { touch = { x: e.clientX, y: e.clientY, used: false }; canvas.setPointerCapture(e.pointerId); }
  function onMove(e) {
    if (!touch) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.hypot(dx, dy) < 18) return;
    setWant(...(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]));
    touch = { x: e.clientX, y: e.clientY, used: true };              // 可以連續滑：每滑一段就換一次方向
  }
  function onUp(e) {
    // 沒有滑動的短按：往點的那一邊走（以貓在畫面上的位置為準）
    if (touch && !touch.used && S) {
      const r = canvas.getBoundingClientRect();
      const { map } = built, vw = canvas.width, vh = canvas.height, px = c => (c + 0.5) * PX;
      const ox = map.width <= vw ? Math.floor((vw - map.width) / 2) : Math.round(Math.min(0, Math.max(vw - map.width, vw / 2 - px(S.cat.x))));
      const oy = map.height <= vh ? Math.floor((vh - map.height) / 2) : Math.round(Math.min(0, Math.max(vh - map.height, vh / 2 - px(S.cat.y))));
      const dx = (e.clientX - r.left) / scale - (ox + px(S.cat.x)), dy = (e.clientY - r.top) / scale - (oy + px(S.cat.y));
      if (Math.hypot(dx, dy) > 4) setWant(...(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]));
    }
    touch = null;
  }

  /* ---------- 開關 ---------- */
  function open() {
    if (!built) {
      built = build();
      built.dogReach = distances(built.dogOK, built.dogStart);      // 巴福柔到得了的格子（廚房以外）
    }
    root.innerHTML = `
      <div class="chase-top"><b>巴福柔追貓</b><div class="chase-hud"></div><button class="chase-close">✕ 離開</button></div>
      <canvas class="chase-canvas"></canvas>
      <div class="chase-card" hidden></div>`;
    root.hidden = false;
    hudText = '';
    canvas = root.querySelector('canvas');
    ctx = canvas.getContext('2d');
    root.querySelector('.chase-close').onclick = close;
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', () => { touch = null; });
    addEventListener('keydown', onKey, true);
    addEventListener('resize', resize);
    resize();
    newLevel(1, 0);                       // 先擺好第一關當背景，上面蓋著開始說明
    S.phase = lastPhase = 'title';
    render();
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function close() {
    running = false;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', resize);
    root.hidden = true;
    root.innerHTML = '';
    S = null;
  }

  return { open, isOpen: () => running, state: () => S, grid: () => built };   // state、grid 方便除錯
}
