// 任務資料：之後在這裡補上實際內容。
// 格式：{ id: '不重複的代號', title: '任務說明' }
export const mainTasks = [];
export const sideTasks = [];

const STORE_KEY = 'bafurou-tasks-done';

function loadDone() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}

function renderList(el, tasks, done) {
  el.innerHTML = '';
  if (!tasks.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '尚未設定';
    el.appendChild(li);
    return;
  }
  for (const t of tasks) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const box = document.createElement('input');
    const text = document.createElement('span');
    box.type = 'checkbox';
    box.checked = !!done[t.id];
    text.textContent = t.title;
    li.classList.toggle('done', box.checked);
    box.addEventListener('change', () => {
      done[t.id] = box.checked;
      li.classList.toggle('done', box.checked);
      localStorage.setItem(STORE_KEY, JSON.stringify(done));
      updateCount(done);
    });
    label.append(box, text);
    li.appendChild(label);
    el.appendChild(li);
  }
}

function updateCount(done) {
  const all = [...mainTasks, ...sideTasks];
  document.getElementById('task-count').textContent = `${all.filter(t => done[t.id]).length}/${all.length}`;
}

export function initTasks() {
  const done = loadDone();
  updateCount(done);
  renderList(document.getElementById('main-tasks'), mainTasks, done);
  renderList(document.getElementById('side-tasks'), sideTasks, done);

  const toggle = document.getElementById('tasks-toggle');
  const panel = document.getElementById('tasks-panel');
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
}
