import * as THREE from 'three';

// 客廳的電視：走到電視前面會問要不要看「災」，要看就在電視螢幕上輪播劇照。
// 看的時候附近會出現控制列，可以放大成全螢幕或關掉。說「不用」之後，要先走開再回來才會再問。
// 劇照放在 assets/tv/，照順序編號。
const PHOTOS = ['01.webp', '02.webp', '03.webp', '04.webp', '05.webp'];
const SHOW = '災';
const EVERY = 4;           // 每張停幾秒
const NEAR = 2.2;          // 走到離電視多近會問（公尺）
const FAR = 3.2;           // 走開多遠算離開（控制列收起來、下次靠近會再問）

export function initTV({ scene, fp, active }) {
  const screen = scene.getObjectByName('tvScreen');
  const prompt = document.getElementById('tv-prompt');
  const full = document.getElementById('tv-full');
  const state = { on: false, at: 0, asked: false, fullscreen: false };

  // 螢幕：貼在原本黑色螢幕前面的一片會發光的畫面；照片照比例縮進去，旁邊補黑邊
  const W = 512, H = Math.round(512 * 0.58 / 1.06);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.58), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  picture.rotation.y = Math.PI / 2;               // 電視掛在西牆、面向東
  picture.position.x = 0.006;
  picture.visible = false;
  picture.raycast = () => {};
  screen.add(picture);

  const images = PHOTOS.map(f => { const im = new Image(); im.src = `assets/tv/${f}`; return im; });
  function paint() {
    const im = images[state.at];
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    if (im.complete && im.naturalWidth) {
      const k = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
      g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    } else im.onload = paint;
    g.fillStyle = 'rgba(0,0,0,.55)';                // 左上角的台標
    g.fillRect(8, 8, 46, 26);
    g.fillStyle = '#fff';
    g.font = 'bold 18px sans-serif';
    g.fillText(SHOW, 21, 28);
    tex.needsUpdate = true;
    if (state.fullscreen) renderFull();
  }

  /* ----- 畫面上的提示與控制列 ----- */
  function renderPrompt(near) {
    if (state.on && near) {
      prompt.innerHTML = `<span>正在看「${SHOW}」 ${state.at + 1}/${PHOTOS.length}</span>
        <button data-tv="prev">◂</button><button data-tv="next">▸</button>
        <button data-tv="full">放大看</button><button data-tv="off">關電視</button>`;
    } else if (!state.on && near && !state.asked) {
      prompt.innerHTML = `<span>要看「${SHOW}」嗎？</span>
        <button data-tv="on" class="primary">看</button><button data-tv="no">不用</button>`;
    } else { prompt.hidden = true; prompt.dataset.view = ''; return; }
    prompt.querySelectorAll('[data-tv]').forEach(b => b.onclick = () => act(b.dataset.tv));
    prompt.hidden = false;
  }
  function renderFull() {
    full.innerHTML = `
      <div class="walk-head">
        <span class="walk-step">「${SHOW}」 ${state.at + 1}/${PHOTOS.length}</span>
        <button data-tv="close">✕ 關閉</button>
      </div>
      <img class="walk-photo" src="assets/tv/${PHOTOS[state.at]}" alt="「${SHOW}」劇照 ${state.at + 1}">
      <div class="walk-nav">
        <button data-tv="prev">◂ 上一張</button>
        <button data-tv="next" class="primary">下一張 ▸</button>
      </div>`;
    full.querySelectorAll('[data-tv]').forEach(b => b.onclick = () => act(b.dataset.tv));
    full.hidden = false;
  }

  let timer = 0, lastView = '';
  function act(what) {
    if (what === 'on') { Object.assign(state, { on: true, at: 0 }); timer = 0; picture.visible = true; paint(); }
    if (what === 'no') state.asked = true;
    if (what === 'off') { Object.assign(state, { on: false, asked: true, fullscreen: false }); picture.visible = false; full.hidden = true; }
    if (what === 'next' || what === 'prev') { state.at = (state.at + (what === 'next' ? 1 : PHOTOS.length - 1)) % PHOTOS.length; timer = 0; paint(); }
    if (what === 'full') { state.fullscreen = true; renderFull(); }
    if (what === 'close') { state.fullscreen = false; full.hidden = true; }
    lastView = '';
  }

  const spot = new THREE.Vector3();
  function update(dt) {
    if (state.on && (timer += dt) >= EVERY) {          // 自動換下一張
      timer = 0;
      state.at = (state.at + 1) % PHOTOS.length;
      paint();
    }
    screen.getWorldPosition(spot);
    const d = active() ? Math.hypot(fp.x - spot.x, fp.z - spot.z) : Infinity;
    if (d > FAR) state.asked = false;                   // 走開了，下次靠近再問
    const near = d < (state.on ? FAR : NEAR);
    const view = `${near}|${state.on}|${state.asked}|${state.at}`;
    if (view !== lastView) { lastView = view; renderPrompt(near); }
  }

  return { state, update };
}
