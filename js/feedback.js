import { play, buzz } from './sound.js';

// 任務的回饋：每完成一個步驟有提示音、目標文字閃一下；整個任務完成時放彩帶、跳出完成橫幅、
// 巴福柔開心地跳一跳搖尾巴。
//   initFeedback({ quests, dog }) 回傳 changed()：任務狀態改變時呼叫，會自己比對前後差在哪裡
export function initFeedback({ quests, dog }) {
  const goal = document.getElementById('goal');
  const toast = document.getElementById('toast');
  const confetti = document.getElementById('confetti');

  const snap = q => ({ finished: q.state.finished, steps: q.state.active ? q.stepsDone() : 0, at: q.state.at });
  const last = new Map(quests.map(q => [q, snap(q)]));

  function changed() {
    for (const q of quests) {
      const was = last.get(q), now = snap(q);
      last.set(q, now);
      if (now.finished > was.finished) celebrate(q.def.title);
      else if (q.state.active && (now.steps > was.steps || now.at > was.at)) stepDone();
    }
  }

  function stepDone() {
    play('step');
    buzz(30);
    goal.classList.remove('pulse'); void goal.offsetWidth; goal.classList.add('pulse');
  }

  let toastTimer = 0;
  function celebrate(title) {
    play('done');
    setTimeout(() => play('woof2'), 650);
    buzz([60, 40, 120]);
    dog.userData.cheer = 2.4;                 // 巴福柔跳一跳（動作在 pets.js）
    toast.innerHTML = `<b>✓ 完成！</b><span>${title}</span>`;
    toast.hidden = false;
    toast.classList.remove('on'); void toast.offsetWidth; toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
    burst();
  }

  // 彩帶：一把小方塊從畫面上方灑下來，動畫結束就移除
  const COLORS = ['#ffd23c', '#d8281c', '#8fd18a', '#5aa9e6', '#f4f4f2', '#e8a23c'];
  function burst(n = 46) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const size = 5 + Math.random() * 6;
      p.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size * (0.6 + Math.random() * 0.8)}px;` +
        `background:${COLORS[i % COLORS.length]};--dx:${(Math.random() - 0.5) * 160}px;--rot:${(Math.random() - 0.5) * 1080}deg;` +
        `animation-duration:${1.6 + Math.random() * 1.4}s;animation-delay:${Math.random() * 0.35}s`;
      p.addEventListener('animationend', () => p.remove());
      confetti.appendChild(p);
    }
  }

  return { changed, celebrate, burst };
}
