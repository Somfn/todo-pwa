import { init, addTask, toggleTask, deleteTask, listTasks } from './db.js';

const $ = s => document.querySelector(s);
let completedOpen = false;

async function render() {
  const tasks = await listTasks();
  const active = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  const activeList = $('#active-tasks');
  activeList.innerHTML = '';

  if (active.length === 0) {
    activeList.innerHTML = '<li class="empty-state">Nothing to do — enjoy your day</li>';
  } else {
    for (const t of active) activeList.appendChild(taskEl(t));
  }

  const toggleBtn = $('#completed-toggle');
  const completedList = $('#completed-tasks');

  if (done.length === 0) {
    toggleBtn.hidden = true;
    completedList.hidden = true;
  } else {
    toggleBtn.hidden = false;
    toggleBtn.querySelector('.count').textContent = done.length;
    completedList.hidden = !completedOpen;
    toggleBtn.setAttribute('aria-expanded', String(completedOpen));
    completedList.innerHTML = '';
    if (completedOpen) {
      for (const t of done) completedList.appendChild(taskEl(t));
    }
  }
}

function taskEl(task) {
  const li = document.createElement('li');
  li.className = 'task-item';
  li.setAttribute('data-done', task.done);
  li.setAttribute('tabindex', '0');
  li.setAttribute('role', 'button');
  li.setAttribute('aria-label', `${task.done ? 'Completed' : 'Active'}: ${task.text}`);

  const check = document.createElement('span');
  check.className = 'task-check';
  check.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;

  const del = document.createElement('button');
  del.className = 'task-delete';
  del.setAttribute('aria-label', `Delete ${task.text}`);
  del.textContent = '×';
  del.addEventListener('click', async e => {
    e.stopPropagation();
    li.classList.add('removing');
    let removed = false;
    const remove = async () => {
      if (removed) return;
      removed = true;
      try {
        await deleteTask(task.id);
      } catch { /* IDB failure — re-render to restore state */ }
      render();
    };
    li.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 350);
  });

  li.addEventListener('click', async () => {
    try {
      await toggleTask(task.id);
    } catch { /* IDB failure — re-render to restore state */ }
    render();
  });

  li.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
  });

  li.append(check, text, del);
  return li;
}

function shakeInput(input) {
  input.classList.add('shake');
  input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
}

async function handleAdd() {
  const input = $('#task-input');
  const text = input.value.trim();

  if (!text || text.length > 300) {
    shakeInput(input);
    return;
  }

  await addTask(text);
  input.value = '';
  render();
  input.focus();
}

function exportTasks() {
  listTasks().then(tasks => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });

  navigator.serviceWorker.register('./sw.js').then(reg => {
    let refreshBound = false;
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          const banner = $('#update-banner');
          banner.classList.add('visible');
          if (!refreshBound) {
            refreshBound = true;
            $('#update-refresh').addEventListener('click', e => {
              e.preventDefault();
              newSW.postMessage('skipWaiting');
            });
          }
        }
      });
    });
  });
}

async function start() {
  try {
    await init();
  } catch {
    document.querySelector('.app').innerHTML =
      '<div class="idb-error"><h2>Storage unavailable</h2>' +
      '<p>This app needs local storage to work. Try opening it in a regular browser window.</p></div>';
    return;
  }

  $('#task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAdd();
  });

  $('#completed-toggle').addEventListener('click', () => {
    completedOpen = !completedOpen;
    render();
  });

  $('#export-btn').addEventListener('click', exportTasks);

  render();
  registerSW();
}

start();
