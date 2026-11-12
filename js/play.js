// 和巴福柔互動：走到牠旁邊點牠，跳出指令選單——握手、趴下、踹人、被人騎、點穴。
// 姿勢本身（坐下舉手、趴下、踢腿、定格）在 pets.js；這裡管流程：什麼時候擺什麼姿勢、
// 牠要轉向哪裡、鏡頭震動、騎上去和下來。
//
//   dog:      巴福柔的模型
//   fp:       玩家的位置與方向
//   canPlay:  現在能不能互動（沒被牽著、沒在吃飯、玩家不是用狗的視角）
//   walkable: 檢查某個位置走不走得到（被踹退的時候用）
const ACTIONS = [
  { id: 'shake', label: '握手', say: '巴福柔坐下，把手伸給你。', time: 3.5 },
  { id: 'down', label: '趴下', say: '巴福柔乖乖趴下。', time: 5 },
  { id: 'kick', label: '踹人', say: '巴福柔轉過身……', time: 2 },
  { id: 'ride', label: '被人騎', say: '你騎上巴福柔了！用搖桿或點地板前進。' },
  { id: 'freeze', label: '點穴', say: '點！巴福柔動不了了。', time: 5.5 },
];

export function initPlay({ dog, fp, canPlay, walkable }) {
  const menu = document.getElementById('pet-menu');
  const flash = document.getElementById('flash');
  const state = { open: false, act: null, t: 0, riding: false, hold: 0, shake: 0 };

  const turnTo = (want, dt, rate = 8) => {
    dog.rotation.y += Math.atan2(Math.sin(want - dog.rotation.y), Math.cos(want - dog.rotation.y)) * Math.min(1, dt * rate);
  };
  const toPlayer = () => Math.atan2(-(fp.x - dog.position.x), -(fp.z - dog.position.z));

  function render(say = '你想讓巴福柔做什麼？') {
    if (!state.open) { menu.hidden = true; return; }
    menu.innerHTML = state.riding
      ? `<p>${say}</p><div class="pet-actions"><button data-act="off" class="primary">下來</button></div>`
      : `<p>${say}</p><div class="pet-actions">${ACTIONS.map(a =>
        `<button data-act="${a.id}" ${state.act ? 'disabled' : ''}>${a.label}</button>`).join('')}<button data-act="close">✕</button></div>`;
    menu.querySelectorAll('[data-act]').forEach(b => b.onclick = () => choose(b.dataset.act));
    menu.hidden = false;
  }

  function close() {
    Object.assign(state, { open: false, act: null, riding: false });
    dog.userData.pose = null;
    dog.rotation.z = 0;
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
    Object.assign(state, { act: id, t: 0, hit: false });
    render(a.say);
  }

  function update(dt, time) {
    state.shake = Math.max(0, state.shake - dt * 2.5);
    if (state.hold > 0) state.hold -= dt;
    if (!state.open) return;
    if (!canPlay()) return close();
    if (state.riding) return;                  // 騎著的時候位置由 main.js 帶著走
    const away = Math.hypot(fp.x - dog.position.x, fp.z - dog.position.z);
    if (away > 3.5) return close();            // 人走遠了，選單收起來

    const { act } = state;
    if (!act) { turnTo(toPlayer(), dt, 5); return; }
    const t = (state.t += dt);
    const a = ACTIONS.find(x => x.id === act);
    if (act === 'shake' || act === 'down') {
      turnTo(toPlayer(), dt);
      dog.userData.pose = act;
    } else if (act === 'kick') {
      // 轉身背對人 → 後腳一踢 → 人被踹退、畫面震動 → 轉回來
      if (t < 1.3) turnTo(toPlayer() + Math.PI, dt, 9); else turnTo(toPlayer(), dt, 6);
      dog.userData.pose = t > 0.7 && t < 1.0 ? 'kick' : null;
      if (t > 0.8 && !state.hit) {
        state.hit = true;
        state.shake = 1;
        flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
        const dx = fp.x - dog.position.x, dz = fp.z - dog.position.z, d = Math.hypot(dx, dz) || 1;
        for (let push = 0.8; push > 0.05; push -= 0.1) {      // 往後退，退不了那麼多就少退一點
          const nx = fp.x + dx / d * push, nz = fp.z + dz / d * push;
          if (walkable(nx, nz, 0.18)) { fp.x = nx; fp.z = nz; break; }
        }
        render('被巴福柔踹了一腳！');
      }
    } else if (act === 'freeze') {
      // 定格 → 像木頭一樣側倒 → 躺幾秒 → 解穴爬起來
      dog.userData.pose = t < 4.6 ? 'frozen' : null;
      const fall = Math.min(1, Math.max(0, (t - 0.5) / 0.6)), up = Math.min(1, Math.max(0, (t - 4.6) / 0.6));
      const tip = fall * fall * (1 - up);
      dog.rotation.z = tip * 1.5;
      dog.position.y = tip * 0.11;
      if (t > 4.6 && !state.hit) { state.hit = true; render('穴道解開了，巴福柔爬起來甩甩頭。'); }
    }
    if (t >= a.time) {
      Object.assign(state, { act: null });
      dog.userData.pose = null;
      dog.rotation.z = 0; dog.position.y = 0;
      render();
    }
  }

  return {
    state, update,
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
