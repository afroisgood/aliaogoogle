import { MISSION } from './mission.js';

// 任務清單面板。必備任務目前只有任務一；支線任務之後補上。
export const sideTasks = [];

export function initTasks(mission) {
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
    const { state } = mission, done = mission.stepsDone();
    main.innerHTML = `
      <li class="mission">
        <div class="mission-title">${MISSION.title}${state.done && !state.active ? '　✓ 已完成' : ''}</div>
        <ol>${MISSION.steps.map((s, i) => `<li class="${i < done ? 'done' : state.active && i === done ? 'now' : ''}">${s.text}</li>`).join('')}</ol>
        <button id="mission-start">${state.active ? '重新開始' : state.done ? '再做一次' : '開始任務'}</button>
      </li>`;
    main.querySelector('#mission-start').onclick = () => { mission.start(); setOpen(false); };
    side.innerHTML = sideTasks.length ? '' : '<li class="empty">尚未設定</li>';
    document.getElementById('task-count').textContent = `${state.done ? 1 : 0}/1`;

    const hint = mission.hint();
    goal.hidden = !hint;
    goal.textContent = hint ? `目標：${hint}` : '';
  }
  render();
  return render;
}
