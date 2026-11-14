// 一天的流程：第一次進站先教操作，接著照順序帶著做主線任務；
// 主線之間穿插支線的「突發事件」。進度存在 localStorage，下次進站從上次的地方繼續。
// 任務清單照樣可以自由挑任務；不管從哪裡開始，做完輪到的那一項就會往下走。
//
//   quests:     { walk, clean, feed, catFeed, litter }（任務物件，state.finished 是完成次數）
//   startQuest: 開始一個任務（會停掉其他任務、切到人的視角）
//   setView, fp: 教學時用來切視角、看玩家有沒有走動和轉頭
import { play } from './sound.js';
import { angleDiff } from './nav.js';

const KEY = 'aliao-day';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export function initFlow({ quests, startQuest, setView, fp }) {
  const DAY = [
    { quest: quests.walk, intro: '早上第一件事：帶巴福柔出門散步。' },
    { quest: quests.catFeed, event: '喵～兩隻貓跑到廚房門口一直叫，肚子餓了。' },
    { quest: quests.clean, intro: '散步回來，換狗房和走廊的尿布墊。' },
    { quest: quests.litter, event: '廚房飄來一股味道……貓砂盆該清了。' },
    { quest: quests.feed, intro: '最後，巴福柔的晚餐時間。' },
  ];
  const saved = load();
  const day = { at: Math.min(saved.at || 0, DAY.length), tutorial: !!saved.tutorial };
  const save = () => localStorage.setItem(KEY, JSON.stringify(day));

  const card = document.getElementById('card');
  const coach = document.getElementById('coach');
  const dayBtn = document.getElementById('day-btn');

  /* ----- 卡片（擋住畫面的對話框）與教學提示列 ----- */
  function showCard(html, buttons) {
    card.innerHTML = `<div class="card-body">${html}<div class="card-actions">${
      buttons.map((b, i) => `<button data-i="${i}" class="${i ? '' : 'primary'}">${b.label}</button>`).join('')}</div></div>`;
    card.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { card.hidden = true; buttons[+el.dataset.i].go(); });
    card.hidden = false;
  }
  const steps = q => `<ol class="card-steps">${q.stepTexts().map(t => `<li>${t}</li>`).join('')}</ol>`;
  const later = { label: '稍後再說', go: () => {} };

  function renderDayBtn() {
    dayBtn.innerHTML = day.at >= DAY.length ? '今天 ✓' : `今天 ${day.at}/${DAY.length}<span class="arr"> ▸</span>`;
  }

  /* ----- 輪到的那一項 ----- */
  function next(prefix = '') {
    renderDayBtn();
    if (day.at >= DAY.length) {
      if (prefix) play('dayDone');
      showCard(`${prefix}<h2>今天的照顧都完成了！</h2><p>巴福柔散過步、吃飽了，家裡也清乾淨了，兩隻貓也照顧好了。辛苦了！</p>`, [
        { label: '重新開始新的一天', go: () => { day.at = 0; save(); next(); } },
        { label: '自己逛逛', go: () => {} },
      ]);
      return;
    }
    const item = DAY[day.at], q = item.quest;
    if (item.event) {
      play('meow');
      showCard(`${prefix}<p class="card-tag">突發事件</p><h2>${item.event}</h2><p>${q.def.title}</p>${steps(q)}`, [
        { label: '好，先去處理', go: () => startQuest(q) },
        { label: '之後再說', go: () => { day.at++; save(); next(); } },
      ]);
    } else {
      showCard(`${prefix}<p class="card-tag">第 ${day.at + 1} 件事（共 ${DAY.length} 件）</p><h2>${q.def.title}</h2><p>${item.intro}</p>${steps(q)}`, [
        { label: '開始', go: () => startQuest(q) },
        later,
      ]);
    }
  }

  /* ----- 第一次進站：歡迎與教學 ----- */
  const TUTORIAL = [
    { text: '點一下地板，走過去看看', done: s => Math.hypot(fp.x - s.x, fp.z - s.z) > 0.6 },
    { text: '按住畫面左右拖曳，環顧四周', done: s => Math.abs(angleDiff(s.yaw, fp.yaw)) > 0.8 },
    { text: '做任務時，黃色菱形就是要點的東西；畫面上方會寫目標，箭頭指出往哪走。右上角「任務清單」可以看全部任務。', button: '知道了' },
  ];
  let lesson = null;       // { i, x, z, yaw }：正在教第幾步、這一步開始時的位置與方向

  function teach(i) {
    if (i >= TUTORIAL.length) return endTutorial();
    lesson = { i, x: fp.x, z: fp.z, yaw: fp.yaw };
    const t = TUTORIAL[i];
    coach.innerHTML = `<span class="coach-step">教學 ${i + 1}/${TUTORIAL.length}</span><span>${t.text}</span>
      ${t.button ? `<button id="coach-ok" class="primary">${t.button}</button>` : ''}<button id="coach-skip">跳過教學</button>`;
    coach.hidden = false;
    if (t.button) coach.querySelector('#coach-ok').onclick = () => teach(i + 1);
    coach.querySelector('#coach-skip').onclick = endTutorial;
  }
  function endTutorial() {
    lesson = null;
    coach.hidden = true;
    day.tutorial = true;
    save();
    next();
  }

  function welcome() {
    showCard(`<h2>阿廖顧狗</h2>
      <p>今天由你照顧巴福柔（黑色的狗）和家裡的兩隻貓。</p>
      <p>跟著指引一件一件做：帶狗散步、換尿布墊、餵狗，中間還會有貓咪的突發狀況。</p>`, [
      { label: '開始教學', go: () => { setView('human'); teach(0); } },
      { label: '跳過教學', go: endTutorial },
    ]);
  }

  /* ----- 任務完成時 ----- */
  const seen = new Map(Object.values(quests).map(q => [q, q.state.finished]));
  function check() {
    for (const [q, n] of seen) {
      if (q.state.finished === n) continue;
      seen.set(q, q.state.finished);
      const item = DAY[day.at];
      if (item && item.quest === q) {
        day.at++;
        save();
        // 先讓完成的彩帶和巴福柔開心的樣子演一下，再跳出下一件事
        setTimeout(() => next(`<p class="card-done">✓ ${q.def.title}　完成！</p>`), 1500);
      }
    }
  }

  function update() {
    if (!lesson) return;
    const t = TUTORIAL[lesson.i];
    if (t.done && t.done(lesson)) teach(lesson.i + 1);
  }

  dayBtn.onclick = () => next();
  renderDayBtn();
  if (!day.tutorial) welcome();
  else if (day.at < DAY.length) next(day.at ? '<p class="card-tag">歡迎回來！接著做下去</p>' : '');

  return { check, update };
}
