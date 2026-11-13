// 和巴福柔互動：走到牠旁邊點牠，跳出指令選單——握手、趴下、踹人、被人騎、點穴。
// 姿勢本身（坐下舉手、趴下、跳起來前腳踢、伸前腳點穴）在 pets.js；這裡管流程：什麼時候擺什麼姿勢、
// 牠要轉向哪裡、鏡頭震動、人被點穴定住、騎上去和下來。
// 踹人：牠跳起來用兩隻前腳踢你。
// 點穴：按摩的那種。人會隨機出現痠痛（走路變慢、偶爾抽痛），請巴福柔用前腳按一按就會緩解。
//
//   dog:      巴福柔的模型
//   fp:       玩家的位置與方向
//   canPlay:  現在能不能互動（沒被牽著、沒在吃飯、玩家不是用狗的視角）
//   walkable: 檢查某個位置走不走得到（被踹退的時候用）
const ACTIONS = [
  { id: 'shake', label: '握手', say: '巴福柔坐下，把手伸給你。', time: 3.5 },
  { id: 'down', label: '趴下', say: '巴福柔乖乖趴下。', time: 5 },
  { id: 'kick', label: '踹人', say: '巴福柔壓低身體……', time: 2 },
  { id: 'ride', label: '被人騎', say: '你騎上巴福柔了！點地板或用方向鍵前進。' },
  { id: 'acu', label: '點穴', say: '巴福柔靠過來，準備幫你按一按……', time: 4.4 },
];

// 會隨機出現的身體狀況
const ACHES = ['肩頸痠痛', '腰痠背痛', '坐骨神經痛'];
const SLOW = 0.6;                    // 痠痛時走路速度變成幾成

export function initPlay({ dog, fp, canPlay, walkable }) {
  const menu = document.getElementById('pet-menu');
  const flash = document.getElementById('flash');
  const state = { open: false, act: null, t: 0, riding: false, hold: 0, shake: 0, still: false, ache: null };
  const acheBox = document.getElementById('ache');
  let acheIn = 40 + Math.random() * 50;      // 再過幾秒出現下一個狀況
  let twinge = 5;                            // 再過幾秒抽痛一下
  function setAche(name) {
    state.ache = name;
    acheBox.hidden = !name;
    if (name) {
      acheBox.innerHTML = `<b>${name}</b><small>走路變慢・找巴福柔點穴</small>`;
      acheBox.classList.remove('new'); void acheBox.offsetWidth; acheBox.classList.add('new');
      state.shake = Math.max(state.shake, 0.5);
    } else acheIn = 90 + Math.random() * 110;
  }

  const turnTo = (want, dt, rate = 8) => {
    dog.rotation.y += Math.atan2(Math.sin(want - dog.rotation.y), Math.cos(want - dog.rotation.y)) * Math.min(1, dt * rate);
  };
  const toPlayer = () => Math.atan2(-(fp.x - dog.position.x), -(fp.z - dog.position.z));

  // 朝人走近到剩 dist 公尺（前面被擋住就停）
  function approach(dist, dt) {
    const dx = fp.x - dog.position.x, dz = fp.z - dog.position.z, d = Math.hypot(dx, dz);
    if (d <= dist) return;
    const step = Math.min(d - dist, 1.8 * dt), nx = dog.position.x + dx / d * step, nz = dog.position.z + dz / d * step;
    if (walkable(nx, nz, 0.15)) { dog.position.x = nx; dog.position.z = nz; }
  }

  function render(say = '你想讓巴福柔做什麼？') {
    if (!state.open) { menu.hidden = true; return; }
    // 動作進行中只留一行說明、騎著時只留「下來」，都縮到畫面上方，不擋住巴福柔
    menu.innerHTML = state.riding
      ? `<p>${say}</p><div class="pet-actions"><button data-act="off" class="primary">下來</button></div>`
      : state.act ? `<p>${say}</p>`
      : `<p>${say}</p><div class="pet-actions">${ACTIONS.map(a =>
        `<button data-act="${a.id}">${a.label}</button>`).join('')}<button data-act="close">✕</button></div>`;
    menu.querySelectorAll('[data-act]').forEach(b => b.onclick = () => choose(b.dataset.act));
    menu.classList.toggle('compact', state.riding || !!state.act);
    menu.hidden = false;
  }

  function close() {
    Object.assign(state, { open: false, act: null, riding: false, still: false });
    dog.userData.pose = null;
    dog.position.y = 0;
    render();
  }

  function choose(id) {
    if (id === 'close') return close();
    if (id === 'off') {                       // 從背上下來：人站到牠旁邊
      state.riding = false;
      // 站到牠旁邊，不要和牠疊在一起：先試左右兩側，不行再試後面、前面
      const sin = Math.sin(dog.rotation.y), cos = Math.cos(dog.rotation.y);
      for (const [side, fwd] of [[0.55, 0], [-0.55, 0], [0, -0.9], [0, 0.9], [0.4, -0.7], [-0.4, -0.7]]) {
        const nx = fp.x + cos * side - sin * fwd, nz = fp.z - sin * side - cos * fwd;
        if (walkable(nx, nz, 0.18)) { fp.x = nx; fp.z = nz; break; }
      }
      render('你從巴福柔背上下來了。');
      return;
    }
    if (state.act) return;
    const a = ACTIONS.find(x => x.id === id);
    if (id === 'ride') {
      state.riding = true;
      fp.x = dog.position.x; fp.z = dog.position.z;
      fp.yaw = dog.rotation.y; fp.pitch = -0.25;
      return render(a.say);
    }
    Object.assign(state, { act: id, t: 0, hit: false, from: null });
    render(a.say);
  }

  function update(dt, time) {
    state.shake = Math.max(0, state.shake - dt * 2.5);
    if (state.hold > 0) state.hold -= dt;
    // 身體狀況：隨機出現；有狀況時每隔幾秒抽痛一下（騎在狗背上不會痛）
    if (!state.ache) { if ((acheIn -= dt) <= 0) setAche(ACHES[Math.floor(Math.random() * ACHES.length)]); }
    else if (!state.riding && !state.act && (twinge -= dt) <= 0) { twinge = 5 + Math.random() * 6; state.shake = Math.max(state.shake, 0.3); }
    if (!state.open) return;
    if (!canPlay()) return close();
    if (state.riding) return;                  // 騎著的時候位置由 main.js 帶著走
    const away = Math.hypot(fp.x - dog.position.x, fp.z - dog.position.z);
    if (away > 3.5 && !state.act) return close();            // 人走遠了，選單收起來

    const { act } = state;
    if (!act) { turnTo(toPlayer(), dt, 5); return; }
    const t = (state.t += dt);
    const a = ACTIONS.find(x => x.id === act);
    if (act === 'shake' || act === 'down') {
      turnTo(toPlayer(), dt);
      dog.userData.pose = act;
    } else if (act === 'kick') {
      // 靠近 → 跳起來撲向人、兩隻前腳踢出去 → 人被踹退、畫面震動 → 落地退回去
      turnTo(toPlayer(), dt, 10);
      if (t < 0.5) approach(1.0, dt);
      const u = (t - 0.5) / 0.55;                        // 跳躍進度 0～1
      if (u > 0 && u < 1) {
        if (!state.from) state.from = [dog.position.x, dog.position.z];
        const dx = fp.x - state.from[0], dz = fp.z - state.from[1], d = Math.hypot(dx, dz) || 1;
        const reach = Math.max(0, Math.min(0.45, d - 0.55)) * Math.sin(Math.PI * u);
        dog.position.set(state.from[0] + dx / d * reach, Math.sin(Math.PI * u) * 0.45, state.from[1] + dz / d * reach);
        dog.userData.pose = 'kick';
      } else {
        dog.position.y = 0;
        dog.userData.pose = null;
      }
      if (u > 0.5 && !state.hit) {
        state.hit = true;
        state.shake = 1;
        flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
        const dx = fp.x - dog.position.x, dz = fp.z - dog.position.z, d = Math.hypot(dx, dz) || 1;
        for (let push = 0.8; push > 0.05; push -= 0.1) {      // 往後退，退不了那麼多就少退一點
          const nx = fp.x + dx / d * push, nz = fp.z + dz / d * push;
          if (walkable(nx, nz, 0.18)) { fp.x = nx; fp.z = nz; break; }
        }
        render('巴福柔跳起來，兩隻前腳踹在你身上！');
      }
    } else if (act === 'acu') {
      // 靠近 → 立起來用前腳一下一下按（四下）→ 痠痛緩解
      turnTo(toPlayer(), dt, 10);
      if (t < 0.9) approach(0.8, dt);
      state.still = t > 0.9 && t < 3.5;                  // 按的時候人站著不動
      const press = t > 0.9 && t < 3.3 && Math.floor((t - 0.9) / 0.3) % 2 === 0;
      dog.userData.pose = press ? 'poke' : t > 0.9 && t < 3.3 ? 'rear' : null;
      if (t > 0.9 && !state.hit) { state.hit = true; render('巴福柔用前腳幫你點穴……按、按、按……'); }
      if (t > 3.3 && state.hit !== 'done') {
        state.hit = 'done';
        const was = state.ache;
        setAche(null);
        render(was ? `好舒服！「${was}」緩解了，走路恢復正常。` : '你現在沒有哪裡痛，不過被按一按還是很舒服。');
      }
    }
    if (t >= a.time) {
      Object.assign(state, { act: null, still: false });
      dog.userData.pose = null;
      dog.position.y = 0;
      render();
    }
  }

  return {
    state, update, setAche,
    speed: () => (state.ache && !state.riding ? SLOW : 1),      // 痠痛時走路變慢（騎狗不受影響）
    busy: () => state.open || state.hold > 0,          // 互動中或玩家正走過來：巴福柔不亂走
    // 和任務物件一樣的點擊介面
    wants: id => id === 'dog' && canPlay() && !state.open,
    notice: () => { state.hold = 8; },                 // 玩家點了牠、正要走過來：先停下來等
    trigger: id => {
      if (id !== 'dog' || !canPlay()) return;
      Object.assign(state, { open: true, act: null, riding: false, hold: 0 });
      render();
    },
  };
}
