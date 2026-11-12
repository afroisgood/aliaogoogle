// 任務清單面板。必備任務依序列出；支線任務之後補上。
// 每個任務物件提供 def、state、start、stop、hint、stepTexts、stepsDone。
export const sideTasks = [];

export function initTasks(missions) {
  const main = document.getElementById('main-tasks');
  const side = document.getElementById('side-tasks');
  const toggle = document.getElementById('tasks-toggle');
  const panel = document.getElementById('tasks-panel');
  const goal = document.getElementById('goal');

  const setOpen = open => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));

  function render() {
    main.innerHTML = missions.map((m, k) => {
      const { state } = m, done = m.stepsDone();
      return `
      <li class="mission">
        <div class="mission-title">${m.def.title}${state.done && !state.active ? '　✓ 已完成' : ''}</div>
        <ol>${m.stepTexts().map((t, i) => `<li class="${i < done ? 'done' : state.active && i === done ? 'now' : ''}">${t}</li>`).join('')}</ol>
        <button data-start="${k}">${state.active ? '重新開始' : state.done ? '再做一次' : '開始任務'}</button>
      </li>`;
    }).join('');
    main.querySelectorAll('[data-start]').forEach(b => b.onclick = () => {
      const m = missions[+b.dataset.start];
      for (const o of missions) if (o !== m) o.stop();      // 同時只做一個任務
      m.start();
      setOpen(false);
    });
    side.innerHTML = sideTasks.length ? '' : '<li class="empty">尚未設定</li>';
    document.getElementById('task-count').textContent =
      `${missions.filter(m => m.state.done).length}/${missions.length}`;

    const active = missions.find(m => m.state.active);
    const hint = active ? active.hint() : '';
    goal.hidden = !hint;
    goal.textContent = hint ? `目標：${hint}` : '';
  }
  render();
  return render;
}
