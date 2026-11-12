// 散步路線：出門後依序顯示街景照片，一步一張。
// 照片放在 assets/walk/，照路線順序編號。text 是那張照片要提醒照顧者的事。
export const WALK_STEPS = [
  { photo: '01.webp', text: '出門後沿著中興街走，往山的方向。' },
  { photo: '02.webp', text: '走到忠孝街的路口（左邊電線桿上有反光鏡），在這裡左轉進忠孝街。' },
  { photo: '03.webp', text: '看到這棟有戶外樓梯的房子時，走左邊的小路（香蕉樹旁邊那條）。' },
  { photo: '04.webp', text: '走到米黃色矮牆這裡，在藍色鐵門的房子前右轉。' },
  { photo: '05.webp', text: '到了花蓮縣考古博物館（有圓柱塔樓的建築），往左走。' },
  { photo: '06.webp', text: '右轉，往停車場的方向走。前面是有彩色塗鴉的藍色房子。' },
  { photo: '07.webp', text: '沿著中山路 127 巷直走，然後右轉。右邊是白牆紅框窗的建築。' },
  { photo: '08.webp', text: '直走到底。會經過左邊的橘色屋頂涼亭。' },
  { photo: '09.webp', text: '走到底的路口，右轉。' },
  { photo: '10.webp', text: '沿著這條路走到路口，準備折返。右邊是藍色鐵皮屋頂和圓柱。' },
];

// 開啟散步頁；走完按「到家了」時呼叫 onDone
export function openWalk(onDone) {
  const root = document.getElementById('walk');
  let n = 0;
  const render = () => {
    const s = WALK_STEPS[n], last = n === WALK_STEPS.length - 1;
    root.innerHTML = `
      <div class="walk-head">
        <span class="walk-step">散步路線　第 ${n + 1} 張／共 ${WALK_STEPS.length} 張</span>
      </div>
      <img class="walk-photo" src="assets/walk/${s.photo}" alt="第 ${n + 1} 張街景">
      <p class="walk-text">${s.text}</p>
      <div class="walk-nav">
        <button id="walk-prev" ${n ? '' : 'disabled'}>◂ 上一張</button>
        <button id="walk-next" class="primary">${last ? '到家了 ✓' : '下一張 ▸'}</button>
      </div>`;
    root.querySelector('#walk-prev').onclick = () => { n--; render(); };
    root.querySelector('#walk-next').onclick = () => {
      if (!last) { n++; return render(); }
      root.hidden = true;
      onDone();
    };
    // 先把下一張載好，換頁才不會等
    if (!last) new Image().src = `assets/walk/${WALK_STEPS[n + 1].photo}`;
  };
  root.hidden = false;
  render();
}
