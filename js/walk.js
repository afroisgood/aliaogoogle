// 散步路線：出門後顯示的路線圖與逐步指引。
// 座標取自屋主手繪的路線圖（僅作示意，不是精確地圖）。
// 每一步可以放一張街景照片：把照片放進 assets/walk/，再把檔名填進該步的 photo。

const P = {                     // 路線上的轉折點
  home: [1170, 150], a: [1000, 90], b: [900, 230], c: [1010, 505], d: [940, 620],
  e: [1000, 680], f: [1075, 745], g: [990, 900], i: [1160, 975], turn: [1000, 1270], j: [1500, 460],
};

const STREETS = [               // 灰色的街道底圖
  [[860, 20], [1000, 90], [1180, 200], [1500, 460], [1680, 580]],
  [[1000, 90], [900, 230], [1010, 505], [1130, 670]],
  [[1010, 505], [940, 620], [1000, 680], [1075, 745], [1130, 670]],
  [[1075, 745], [990, 900], [880, 1120]],
  [[860, 830], [990, 900], [1160, 975], [1400, 1090]],
  [[1000, 1270], [1160, 975], [1500, 460]],
  [[720, 1090], [1000, 1270], [1090, 1325]],
];

const LANDMARKS = [
  { at: [1120, 262], text: '豐田教會', anchor: 'start' },
  { at: [1105, 712], text: '考古博物館', anchor: 'start' },
  { at: [1535, 500], text: '全家便利商店', anchor: 'start' },
  { at: [960, 1300], text: '折返點', anchor: 'end', strong: true },
  { at: [1205, 140], text: '家', anchor: 'start', strong: true },
];

export const WALK_STEPS = [
  { at: 'home', to: 'a', title: '出門', text: '出門後沿著門前的街往西北走（豐田教會在街的斜對面），走到第一個路口。', photo: '' },
  { at: 'a', to: 'b', title: '第一個路口左轉', text: '左轉進巷子，沿著巷子往南走。豐田教會會在你的左手邊。', photo: '' },
  { at: 'c', to: 'd', title: '岔路走右邊', text: '走到岔路，走右邊那一條。', photo: '' },
  { at: 'd', to: 'f', title: '左轉經過博物館', text: '接著左轉，經過花蓮縣考古博物館。', photo: '' },
  { at: 'f', to: 'g', title: '過博物館後右轉', text: '過了博物館右轉，往南走到下一個路口。', photo: '' },
  { at: 'g', to: 'i', title: '路口左轉', text: '在路口左轉，走到下一個路口。', photo: '' },
  { at: 'i', to: 'turn', title: '右轉走到折返點', text: '右轉，沿著直路一直往南走，到忠孝街 12 巷的路口。這裡是折返點。', photo: '' },
  { at: 'turn', to: 'i', title: '折返', text: '掉頭沿原路往回走。回到剛才右轉進來的路口時不要轉彎，繼續直走。', photo: '' },
  { at: 'i', to: 'j', title: '一路直走', text: '沿著這條直路一直走到底，會接到大一點的街，附近有全家便利商店。', photo: '' },
  { at: 'j', to: 'home', title: '左轉回家', text: '在路口左轉，沿街走回家。家在你的右手邊。', photo: '' },
];

const OUT = ['home', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'i', 'turn'];
const BACK = ['turn', 'i', 'j', 'home'];

const line = pts => pts.map(p => p.join(',')).join(' ');
// 回程線往旁邊偏一點，才不會跟去程重疊
const shifted = keys => keys.map(k => [P[k][0] + 16, P[k][1] + 9]);

function mapSvg(current) {
  const step = WALK_STEPS[current];
  const [cx, cy] = P[step.at], [tx, ty] = P[step.to];
  const ang = Math.atan2(ty - cy, tx - cx) * 180 / Math.PI;
  return `
<svg viewBox="700 0 1120 1340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="散步路線圖">
  <rect x="700" y="0" width="1120" height="1340" fill="#efe6d8"/>
  ${STREETS.map(s => `<polyline points="${line(s)}" fill="none" stroke="#b9b2a6" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
  ${STREETS.map(s => `<polyline points="${line(s)}" fill="none" stroke="#fbf7f0" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
  <polyline points="${line(OUT.map(k => P[k]))}" fill="none" stroke="#d8281c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${line(shifted(BACK))}" fill="none" stroke="#2b6fd1" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 18"/>
  ${LANDMARKS.map(l => `<text x="${l.at[0]}" y="${l.at[1]}" text-anchor="${l.anchor}" font-size="${l.strong ? 44 : 34}" font-weight="700" fill="${l.strong ? '#d8281c' : '#5a5348'}" stroke="#efe6d8" stroke-width="8" paint-order="stroke">${l.text}</text>`).join('')}
  <rect x="${P.home[0] - 22}" y="${P.home[1] - 22}" width="44" height="44" fill="#d8281c" stroke="#fff" stroke-width="5"/>
  <circle cx="${P.turn[0]}" cy="${P.turn[1]}" r="20" fill="#fff" stroke="#d8281c" stroke-width="8"/>
  ${WALK_STEPS.map((s, n) => {
    const [x, y] = n >= 7 ? [P[s.at][0] + 16 + (n === 9 ? 0 : 38), P[s.at][1] + 9 + (n === 7 ? 20 : 0)] : P[s.at];
    const on = n === current;
    return n === 0 ? '' : `<circle cx="${x}" cy="${y}" r="${on ? 30 : 22}" fill="${on ? '#ffd23c' : n >= 7 ? '#2b6fd1' : '#d8281c'}" stroke="#fff" stroke-width="4"/>
      <text x="${x}" y="${y + 11}" text-anchor="middle" font-size="30" font-weight="700" fill="${on ? '#2a1d0c' : '#fff'}">${n + 1}</text>`;
  }).join('')}
  <g transform="translate(${cx + (current >= 7 ? 16 : 0)},${cy + (current >= 7 ? 9 : 0)}) rotate(${ang})">
    <polygon points="44,0 100,0 100,-18 140,8 100,34 100,16 44,16" fill="#ffd23c" stroke="#2a1d0c" stroke-width="5" stroke-linejoin="round" transform="translate(0,-8)"/>
  </g>
  <g font-size="28" font-weight="700" fill="#5a5348">
    <line x1="1560" y1="1245" x2="1620" y2="1245" stroke="#d8281c" stroke-width="9"/><text x="1632" y="1255">去程</text>
    <line x1="1560" y1="1295" x2="1620" y2="1295" stroke="#2b6fd1" stroke-width="9" stroke-dasharray="4 18" stroke-linecap="round"/><text x="1632" y="1305">回程</text>
  </g>
</svg>`;
}

// 開啟散步頁；走完按「到家了」時呼叫 onDone
export function openWalk(onDone) {
  const root = document.getElementById('walk');
  let n = 0;
  const render = () => {
    const s = WALK_STEPS[n], last = n === WALK_STEPS.length - 1;
    root.innerHTML = `
      <div class="walk-map">${mapSvg(n)}</div>
      <div class="walk-card">
        <div class="walk-step">第 ${n + 1} 步／共 ${WALK_STEPS.length} 步</div>
        <h2>${s.title}</h2>
        <p>${s.text}</p>
        ${s.photo ? `<img class="walk-photo" src="assets/walk/${s.photo}" alt="${s.title}的街景">` : '<div class="walk-photo empty">街景照片待補</div>'}
        <div class="walk-nav">
          <button id="walk-prev" ${n ? '' : 'disabled'}>◂ 上一步</button>
          <button id="walk-next" class="primary">${last ? '到家了 ✓' : '下一步 ▸'}</button>
        </div>
      </div>`;
    root.querySelector('#walk-prev').onclick = () => { n--; render(); };
    root.querySelector('#walk-next').onclick = () => {
      if (!last) { n++; return render(); }
      root.hidden = true;
      onDone();
    };
  };
  root.hidden = false;
  render();
}
