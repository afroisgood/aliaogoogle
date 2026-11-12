// 任務清單面板：必備任務與支線任務。同時只做一個任務。
// 每個任務物件提供 def、state、start、stop、hint、stepTexts、stepsDone。
export function initTasks(missions, sides) {
  const main = document.getElementById('main-tasks');
  const side = document.getElementById('side-tasks');
  const toggle = document.getElementById('tasks-toggle');
  const panel = document.getElementById('tasks-panel');
  const goal = document.getElementById('goal');
  const all = [...missions, ...sides];

  const setOpen = open => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));

  const item = m => {
    const { state } = m, done = m.stepsDone(), k = all.indexOf(m);
    return `
      <li class="mission">
        <div class="mission-title">${m.def.title}${state.done && !state.active ? '　✓ 已完成' : ''}</div>
        <ol>${m.stepTexts().map((t, i) => `<li class="${i < done ? 'done' : state.active && i === done ? 'now' : ''}">${t}</li>`).join('')}</ol>
        <button data-start="${k}">${state.active ? '重新開始' : state.done ? '再做一次' : '開始任務'}</button>
      </li>`;
  };

  function render() {
    main.innerHTML = missions.map(item).join('');
    side.innerHTML = sides.length ? sides.map(item).join('') : '<li class="empty">尚未設定</li>';
    panel.querySelectorAll('[data-start]').forEach(b => b.onclick = () => {
      const m = all[+b.dataset.start];
      for (const o of all) if (o !== m) o.stop();
      m.start();
      setOpen(false);
    });
    // 狀態列的數字只算必備任務
    document.getElementById('task-count').textContent =
      `${missions.filter(m => m.state.done).length}/${missions.length}`;

    const active = all.find(m => m.state.active);
    const hint = active ? active.hint() : '';
    goal.hidden = !hint;
    goal.textContent = hint ? `目標：${hint}` : '';
  }
  render();
  return render;
}
