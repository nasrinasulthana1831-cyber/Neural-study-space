/* ========== STUDY PLANNER - Data & Auth ========== */
const STORAGE = {
  users: 'studyPlanner_users',
  subjects: 'studyPlanner_subjects',
  tasks: 'studyPlanner_tasks',
  current: 'studyPlanner_currentUser'
};

const SUBJECT_COLORS = [
  '#2d5a4a', '#c45c3e', '#5a4a8c', '#2a7a6e', '#8b5a3c',
  '#4a6b8a', '#9e3d27', '#3d7a65', '#6b4a7a', '#2d6a5a'
];

let currentUser = null;

function id() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function getJson(key, def = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch { return def; }
}

function setJson(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function getUsers() { return getJson(STORAGE.users, []); }
function getSubjects() { return getJson(STORAGE.subjects, {}); }
function getTasks() { return getJson(STORAGE.tasks, {}); }

function saveUsers(v) { setJson(STORAGE.users, v); }
function saveSubjects(v) { setJson(STORAGE.subjects, v); }
function saveTasks(v) { setJson(STORAGE.tasks, v); }

function userSubjects() {
  if (!currentUser) return [];
  const all = getSubjects();
  return all[currentUser.id] || [];
}

function userTasks() {
  if (!currentUser) return [];
  const all = getTasks();
  return all[currentUser.id] || [];
}

function setUserSubs(arr) {
  const all = getSubjects();
  all[currentUser.id] = arr;
  saveSubjects(all);
}

function setUserTasks(arr) {
  const all = getTasks();
  all[currentUser.id] = arr;
  saveTasks(all);
}

/* ========== Auth ========== */
function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-name').textContent = currentUser?.name || 'Student';
  renderAll();
  const activeView = document.querySelector('.view.active')?.id?.replace('view-', '');
  if (activeView) {
    document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.bottom-nav-item[data-view="${activeView}"]`)?.classList.add('active');
  }
}

function loadSession() {
  currentUser = getJson(STORAGE.current);
  if (currentUser) showApp();
  else showAuth();
}

function logout() {
  currentUser = null;
  localStorage.removeItem(STORAGE.current);
  showAuth();
}

function signup(name, email, password) {
  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, msg: 'Email already registered.' };
  }
  const user = { id: id(), name: name.trim(), email: email.toLowerCase(), password: btoa(password) };
  users.push(user);
  saveUsers(users);
  currentUser = { id: user.id, name: user.name, email: user.email };
  setJson(STORAGE.current, currentUser);
  return { ok: true };
}

function login(email, password) {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== btoa(password)) {
    return { ok: false, msg: 'Invalid email or password.' };
  }
  currentUser = { id: user.id, name: user.name, email: user.email };
  setJson(STORAGE.current, currentUser);
  return { ok: true };
}

/* ========== Subjects CRUD ========== */
function addSubject(name, color) {
  const arr = userSubjects();
  arr.push({ id: id(), name: name.trim(), color: color || SUBJECT_COLORS[0] });
  setUserSubs(arr);
}

function updateSubject(id, name, color) {
  const arr = userSubjects().map(s =>
    s.id === id ? { ...s, name: name.trim(), color: color || s.color } : s
  );
  setUserSubs(arr);
}

function deleteSubject(id) {
  setUserSubs(userSubjects().filter(s => s.id !== id));
  setUserTasks(userTasks().filter(t => t.subjectId !== id));
}

function getSubject(id) {
  return userSubjects().find(s => s.id === id);
}

/* ========== Tasks CRUD ========== */
function addTask(title, subjectId, deadline) {
  const arr = userTasks();
  arr.push({
    id: id(), subjectId, title: title.trim(), deadline: deadline || null, completed: false, createdAt: new Date().toISOString()
  });
  setUserTasks(arr);
}

function updateTask(id, title, subjectId, deadline) {
  const arr = userTasks().map(t =>
    t.id === id ? { ...t, title: title.trim(), subjectId, deadline: deadline || null } : t
  );
  setUserTasks(arr);
}

function deleteTask(id) {
  setUserTasks(userTasks().filter(t => t.id !== id));
}

function toggleTaskComplete(id) {
  const arr = userTasks().map(t =>
    t.id === id ? { ...t, completed: !t.completed } : t
  );
  setUserTasks(arr);
}

function getTask(id) {
  return userTasks().find(t => t.id === id);
}

/* ========== AI Assistant ========== */
function getAISuggestions() {
  const subjects = userSubjects();
  const tasks = userTasks().filter(t => !t.completed);
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dueSoon = tasks.filter(t => t.deadline && new Date(t.deadline) <= in24h).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const out = [];

  if (dueSoon.length > 0) {
    const t = dueSoon[0];
    const sub = getSubject(t.subjectId);
    const d = t.deadline ? new Date(t.deadline) : null;
    out.push({
      type: 'priority',
      text: `Focus on <strong>${escapeHtml(t.title)}</strong>${sub ? ` (${sub.name})` : ''} — ${d ? 'due ' + formatDeadline(d) : 'no deadline'}.`
    });
  }

  if (tasks.length === 0 && subjects.length > 0) {
    out.push({ type: 'tip', text: 'All tasks are done. Add new tasks to your subjects or take a short break.' });
  } else if (tasks.length > 3) {
    out.push({ type: 'tip', text: `You have <strong>${tasks.length}</strong> pending tasks. Prioritize by deadline, then by subject.` });
  }

  if (subjects.length === 0) {
    out.push({ type: 'tip', text: 'Add subjects first, then add tasks to each. This helps the AI suggest a better order.' });
  }

  if (out.length === 0) {
    out.push({ type: 'tip', text: 'Add subjects and tasks with deadlines to get personalized study suggestions.' });
  }

  return out;
}

function getAITips() {
  const tasks = userTasks();
  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;
  const tips = [
    'Study in 25–30 minute blocks, then take a 5-minute break.',
    'Tackle the hardest or most urgent task first when you’re fresh.',
    'Review your deadlines every morning to plan the day.',
  ];
  if (total > 0 && completed / total >= 0.5) {
    tips.push('You’re over halfway. Keep the same rhythm to finish strong.');
  }
  if (tasks.some(t => t.deadline && new Date(t.deadline) < new Date() && !t.completed)) {
    tips.unshift('Some tasks are past their deadline. Update deadlines or complete them next.');
  }
  return tips;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatDeadline(d) {
  const dt = new Date(d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const td = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diff = Math.floor((td - today) / (24 * 60 * 60 * 1000));
  const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 0) return 'overdue';
  if (diff === 0) return `today at ${time}`;
  if (diff === 1) return `tomorrow at ${time}`;
  return dt.toLocaleDateString() + ' ' + time;
}

/* ========== Render ========== */
function renderAll() {
  renderDashboard();
  renderSubjects();
  renderTasks();
  renderAI();
  renderTaskSelects();
  renderColorPicker();
}

function renderDashboard() {
  const subjects = userSubjects();
  const tasks = userTasks();
  const completed = tasks.filter(t => t.completed).length;
  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const dueSoon = tasks.filter(t => !t.completed && t.deadline && new Date(t.deadline) <= in3d).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  document.getElementById('stat-subjects').textContent = subjects.length;
  document.getElementById('stat-tasks').textContent = tasks.length;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-due').textContent = dueSoon.length;

  const list = document.getElementById('dashboard-due-list');
  const empty = document.getElementById('dashboard-due-empty');
  list.innerHTML = '';
  if (dueSoon.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
  } else {
    list.classList.remove('hidden');
    empty.classList.add('hidden');
    dueSoon.slice(0, 5).forEach(t => {
      const sub = getSubject(t.subjectId);
      const el = document.createElement('div');
      el.className = 'task-mini' + (t.completed ? ' done' : '');
      el.innerHTML = `
        <span class="dot" style="background:${sub?.color || '#888'}"></span>
        <span>${escapeHtml(t.title)}</span>
        <span class="deadline">${t.deadline ? formatDeadline(t.deadline) : '—'}</span>
      `;
      list.appendChild(el);
    });
  }
}

function renderSubjects() {
  const list = document.getElementById('subjects-list');
  const empty = document.getElementById('subjects-empty');
  const subjects = userSubjects();

  list.innerHTML = '';
  if (subjects.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
  } else {
    list.classList.remove('hidden');
    empty.classList.add('hidden');
    subjects.forEach(s => {
      const count = userTasks().filter(t => t.subjectId === s.id).length;
      const done = userTasks().filter(t => t.subjectId === s.id && t.completed).length;
      const card = document.createElement('div');
      card.className = 'subject-card';
      card.style.borderLeftColor = s.color;
      card.innerHTML = `
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="meta">${count} tasks · ${done} done</div>
        <div class="actions">
          <button type="button" class="btn-icon edit" data-id="${s.id}" title="Edit">✎</button>
          <button type="button" class="btn-icon delete" data-id="${s.id}" title="Delete">🗑</button>
        </div>
      `;
      list.appendChild(card);
    });
  }
}

function renderTasks() {
  const list = document.getElementById('tasks-list');
  const empty = document.getElementById('tasks-empty');
  const filter = document.querySelector('.filter-tab.active')?.dataset.filter || 'all';
  const subId = document.getElementById('filter-subject')?.value || '';

  let tasks = userTasks();
  if (subId) tasks = tasks.filter(t => t.subjectId === subId);
  if (filter === 'pending') tasks = tasks.filter(t => !t.completed);
  if (filter === 'completed') tasks = tasks.filter(t => t.completed);
  tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    return (a.deadline ? 0 : 1) - (b.deadline ? 0 : 1);
  });

  list.innerHTML = '';
  if (tasks.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
  } else {
    list.classList.remove('hidden');
    empty.classList.add('hidden');
    const now = new Date();
    tasks.forEach(t => {
      const sub = getSubject(t.subjectId);
      const overdue = t.deadline && !t.completed && new Date(t.deadline) < now;
      const row = document.createElement('div');
      row.className = 'task-row' + (t.completed ? ' completed' : '') + (overdue ? ' overdue' : '');
      row.innerHTML = `
        <div class="task-check" data-id="${t.id}" role="button" aria-label="Toggle complete">${t.completed ? '✓' : ''}</div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            ${sub ? `<span class="subject-tag" style="background:${sub.color}20;color:${sub.color}">${escapeHtml(sub.name)}</span>` : ''}
          </div>
        </div>
        <div class="task-deadline">${t.deadline ? formatDeadline(t.deadline) : 'No deadline'}</div>
        <div class="task-actions">
          <button type="button" class="btn-icon edit" data-id="${t.id}" title="Edit">✎</button>
          <button type="button" class="btn-icon delete" data-id="${t.id}" title="Delete">🗑</button>
        </div>
      `;
      list.appendChild(row);
    });
  }
}

function renderAI() {
  const sug = document.getElementById('ai-suggestions');
  const tips = document.getElementById('ai-tips-list');
  sug.innerHTML = '';
  getAISuggestions().forEach(s => {
    const d = document.createElement('div');
    d.className = 'ai-suggestion';
    d.innerHTML = s.text;
    sug.appendChild(d);
  });
  tips.innerHTML = '';
  getAITips().forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    tips.appendChild(li);
  });
}

function renderTaskSelects() {
  const opts = userSubjects().map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`);
  const sel = '<option value="">All subjects</option>' + opts.join('');
  const fs = document.getElementById('filter-subject');
  const ts = document.getElementById('task-subject');
  if (fs) fs.innerHTML = sel;
  if (ts) {
    ts.innerHTML = '<option value="">Select subject</option>' + opts.join('');
  }
}

function renderColorPicker() {
  const el = document.getElementById('subject-color-picker');
  if (!el) return;
  el.innerHTML = '';
  SUBJECT_COLORS.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'color-opt';
    b.style.background = c;
    b.dataset.color = c;
    el.appendChild(b);
  });
}

/* ========== Modals ========== */
function openSubjectModal(editId = null) {
  const m = document.getElementById('subject-modal');
  const form = document.getElementById('subject-form');
  const title = document.getElementById('subject-modal-title');
  form.reset();
  document.getElementById('subject-id').value = editId || '';

  document.querySelectorAll('.color-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.color === (editId ? getSubject(editId)?.color : SUBJECT_COLORS[0]));
  });

  if (editId) {
    const s = getSubject(editId);
    if (s) {
      title.textContent = 'Edit subject';
      document.getElementById('subject-name').value = s.name;
      document.querySelector(`.color-opt[data-color="${s.color}"]`)?.classList.add('selected');
    }
  } else {
    title.textContent = 'Add subject';
    document.querySelector(`.color-opt[data-color="${SUBJECT_COLORS[0]}"]`)?.classList.add('selected');
  }
  m.classList.add('open');
}

function closeSubjectModal() {
  document.getElementById('subject-modal').classList.remove('open');
}

function openTaskModal(editId = null) {
  const m = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  const title = document.getElementById('task-modal-title');
  form.reset();
  document.getElementById('task-id').value = editId || '';
  renderTaskSelects();

  if (editId) {
    const t = getTask(editId);
    if (t) {
      title.textContent = 'Edit task';
      document.getElementById('task-title').value = t.title;
      document.getElementById('task-subject').value = t.subjectId;
      if (t.deadline) {
        const d = new Date(t.deadline);
        document.getElementById('task-deadline').value = d.toISOString().slice(0, 16);
      }
    }
  } else {
    title.textContent = 'Add task';
  }
  m.classList.add('open');
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('open');
}

/* ========== Views ========== */
function setView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));
  const v = document.getElementById('view-' + name);
  const n = document.querySelector(`.nav-item[data-view="${name}"]`);
  const bn = document.querySelector(`.bottom-nav-item[data-view="${name}"]`);
  if (v) v.classList.add('active');
  if (n) n.classList.add('active');
  if (bn) bn.classList.add('active');
  renderAll();
}

/* ========== Event wiring ========== */
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  }
  loadSession();

  // Auth
  document.getElementById('login-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const err = document.getElementById('login-error');
    const r = login(document.getElementById('login-email').value, document.getElementById('login-password').value);
    if (r.ok) showApp();
    else { err.textContent = r.msg; }
  });

  document.getElementById('signup-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const err = document.getElementById('signup-error');
    const r = signup(
      document.getElementById('signup-name').value,
      document.getElementById('signup-email').value,
      document.getElementById('signup-password').value
    );
    if (r.ok) showApp();
    else { err.textContent = r.msg; }
  });

  document.getElementById('show-signup')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
    document.getElementById('login-error').textContent = '';
    document.getElementById('signup-error').textContent = '';
  });

  document.getElementById('show-login')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('login-error').textContent = '';
    document.getElementById('signup-error').textContent = '';
  });

  document.getElementById('btn-logout')?.addEventListener('click', logout);

  // Nav
  document.querySelectorAll('.nav-item').forEach(n => {
    n.addEventListener('click', e => { e.preventDefault(); setView(n.dataset.view); });
  });
  document.querySelectorAll('.bottom-nav-item').forEach(n => {
    n.addEventListener('click', e => { e.preventDefault(); setView(n.dataset.view); });
  });

  // Subject modal
  document.getElementById('btn-add-subject')?.addEventListener('click', () => openSubjectModal());

  document.getElementById('subject-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('subject-id').value || null;
    const name = document.getElementById('subject-name').value.trim();
    const sel = document.querySelector('.color-opt.selected');
    const color = sel?.dataset.color || SUBJECT_COLORS[0];
    if (id) updateSubject(id, name, color);
    else addSubject(name, color);
    closeSubjectModal();
    renderAll();
  });

  document.getElementById('subject-cancel')?.addEventListener('click', closeSubjectModal);

  document.getElementById('subject-color-picker')?.addEventListener('click', e => {
    const t = e.target.closest('.color-opt');
    if (!t) return;
    document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('selected'));
    t.classList.add('selected');
  });

  document.getElementById('subjects-list')?.addEventListener('click', e => {
    const id = e.target.closest('.edit')?.dataset.id;
    const del = e.target.closest('.delete')?.dataset.id;
    if (id) openSubjectModal(id);
    if (del) { if (confirm('Delete this subject and its tasks?')) { deleteSubject(del); renderAll(); } }
  });

  // Task modal
  document.getElementById('btn-add-task')?.addEventListener('click', () => openTaskModal());

  document.getElementById('task-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('task-id').value || null;
    const title = document.getElementById('task-title').value.trim();
    const subjectId = document.getElementById('task-subject').value;
    const deadline = document.getElementById('task-deadline').value || null;
    if (!subjectId) return;
    if (id) updateTask(id, title, subjectId, deadline);
    else addTask(title, subjectId, deadline);
    closeTaskModal();
    renderAll();
  });

  document.getElementById('task-cancel')?.addEventListener('click', closeTaskModal);

  document.getElementById('tasks-list')?.addEventListener('click', e => {
    const check = e.target.closest('.task-check');
    const edit = e.target.closest('.edit');
    const del = e.target.closest('.delete');
    if (check) { toggleTaskComplete(check.dataset.id); renderAll(); }
    if (edit) openTaskModal(edit.dataset.id);
    if (del) { if (confirm('Delete this task?')) { deleteTask(del.dataset.id); renderAll(); } }
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      t.classList.add('active');
      renderTasks();
    });
  });

  document.getElementById('filter-subject')?.addEventListener('change', renderTasks);

  // Modal backdrops
  document.getElementById('subject-modal')?.addEventListener('click', e => {
    if (e.target.id === 'subject-modal') closeSubjectModal();
  });
  document.getElementById('task-modal')?.addEventListener('click', e => {
    if (e.target.id === 'task-modal') closeTaskModal();
  });
});
