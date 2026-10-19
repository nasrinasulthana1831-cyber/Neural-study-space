/* ========== STUDY PLANNER - Data & Auth ========== */
const STORAGE = {
  users: 'studyPlanner_users',
  subjects: 'studyPlanner_subjects',
  tasks: 'studyPlanner_tasks',
  sessions: 'studyPlanner_sessions',
  current: 'studyPlanner_currentUser',
  theme: 'studyPlanner_theme'
};

// Set this to your server endpoint; never put a model API key in this file.
const AI_API_ENDPOINT = '';

const SUBJECT_COLORS = [
  '#2d5a4a', '#c45c3e', '#5a4a8c', '#2a7a6e', '#8b5a3c',
  '#4a6b8a', '#9e3d27', '#3d7a65', '#6b4a7a', '#2d6a5a'
];

let currentUser = null;
let aiConversation = [];
const focusDuration = 25 * 60;
let focusRemaining = focusDuration;
let focusInterval = null;
let focusEndsAt = null;
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

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
function getSessions() { return getJson(STORAGE.sessions, {}); }

function saveUsers(v) { setJson(STORAGE.users, v); }
function saveSubjects(v) { setJson(STORAGE.subjects, v); }
function saveTasks(v) { setJson(STORAGE.tasks, v); }
function saveSessions(v) { setJson(STORAGE.sessions, v); }

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

function userSessions() {
  if (!currentUser) return [];
  const all = getSessions();
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

function setUserSessions(arr) {
  const all = getSessions();
  all[currentUser.id] = arr;
  saveSessions(all);
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
  window.clearInterval(focusInterval);
  focusInterval = null;
  focusEndsAt = null;
  focusRemaining = focusDuration;
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

function getAIPlannerContext() {
  const pendingTasks = userTasks()
    .filter(task => !task.completed)
    .sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      return a.deadline ? -1 : b.deadline ? 1 : 0;
    });

  return {
    subjects: userSubjects().map(subject => subject.name),
    pendingTasks: pendingTasks.slice(0, 8).map(task => ({
      title: task.title,
      subject: getSubject(task.subjectId)?.name || 'Unassigned',
      deadline: task.deadline
    }))
  };
}

function getDemoAIResponse(message) {
  const prompt = message.toLowerCase();
  const tasks = getAIPlannerContext().pendingTasks;
  const nextTask = tasks[0];

  if (!nextTask) {
    return 'Your planner has no pending tasks right now. Add a task with a deadline and I can help you shape a focused study plan.';
  }

  const taskLabel = `“${nextTask.title}” for ${nextTask.subject}`;
  const deadline = nextTask.deadline ? `, due ${formatDeadline(nextTask.deadline)}` : '';

  if (prompt.includes('break') || prompt.includes('smaller') || prompt.includes('steps')) {
    return `For ${taskLabel}, try this: 1) gather the materials, 2) work through one small section for 25 minutes, 3) take a 5-minute break, then 4) check your work and note what remains. Adjust the steps to fit the assignment.`;
  }
  if (prompt.includes('first') || prompt.includes('focus') || prompt.includes('priority')) {
    return `Start with ${taskLabel}${deadline}. Set a 25-minute timer, define one small outcome, and take a short break before deciding what comes next.`;
  }
  if (prompt.includes('plan') || prompt.includes('today') || prompt.includes('session')) {
    return `A simple session: begin with ${taskLabel}${deadline}, study for 25 minutes, then take a 5-minute break. If you have time, review the next task on your list. Keep the goal small enough to finish in one sitting.`;
  }
  return `You have ${tasks.length} pending task${tasks.length === 1 ? '' : 's'} in your planner. Your nearest listed priority is ${taskLabel}${deadline}. Ask me to plan your session, choose a task, or break an assignment into steps.`;
}

function appendChatMessage(role, text) {
  const log = document.getElementById('ai-chat-log');
  const message = document.createElement('div');
  message.className = `chat-message ${role}`;
  const label = document.createElement('span');
  label.className = 'message-label';
  label.textContent = role === 'user' ? 'You' : 'Study assistant';
  const content = document.createElement('p');
  content.textContent = text;
  message.append(label, content);
  log.appendChild(message);
  log.scrollTop = log.scrollHeight;
  return message;
}

function appendTypingIndicator() {
  const message = document.createElement('div');
  message.className = 'chat-message assistant typing-indicator';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-label', 'Study assistant is responding');
  const label = document.createElement('span');
  label.className = 'message-label';
  label.textContent = 'Study assistant';
  const dots = document.createElement('span');
  dots.className = 'typing-dots';
  for (let index = 0; index < 3; index += 1) dots.appendChild(document.createElement('span'));
  message.append(label, dots);
  const log = document.getElementById('ai-chat-log');
  log.appendChild(message);
  log.scrollTop = log.scrollHeight;
  return message;
}

async function sendAIMessage(value) {
  const input = document.getElementById('ai-chat-input');
  const submit = document.querySelector('#ai-chat-form button[type="submit"]');
  const status = document.getElementById('ai-chat-status');
  const message = value.trim();
  if (!message) {
    status.textContent = 'Write a message before sending.';
    input.focus();
    return;
  }

  status.textContent = '';
  input.value = '';
  input.disabled = true;
  submit.disabled = true;
  appendChatMessage('user', message);
  const typing = appendTypingIndicator();

  try {
    let reply;
    if (AI_API_ENDPOINT) {
      const response = await fetch(AI_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: aiConversation.slice(-8),
          context: getAIPlannerContext()
        })
      });
      if (!response.ok) throw new Error(`Assistant service returned ${response.status}.`);
      const result = await response.json();
      if (typeof result.reply !== 'string' || !result.reply.trim()) {
        throw new Error('Assistant service returned an invalid response.');
      }
      reply = result.reply.trim();
    } else {
      await new Promise(resolve => window.setTimeout(resolve, 500));
      reply = getDemoAIResponse(message);
    }

    typing.remove();
    appendChatMessage('assistant', reply);
    aiConversation.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
  } catch (error) {
    typing.remove();
    status.textContent = error.message || 'The assistant could not respond. Please try again.';
  } finally {
    input.disabled = false;
    submit.disabled = false;
    input.focus();
  }
}

function initializeAIChat() {
  const badge = document.getElementById('ai-mode-badge');
  const note = document.getElementById('ai-mode-note');
  if (AI_API_ENDPOINT) {
    badge.textContent = 'Backend configured';
    note.textContent = 'Messages and selected planner details are sent to your configured backend. No API keys are stored in this app.';
  }

  document.getElementById('ai-chat-form')?.addEventListener('submit', event => {
    event.preventDefault();
    sendAIMessage(document.getElementById('ai-chat-input').value);
  });
  document.getElementById('ai-chat-input')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form.requestSubmit();
    }
  });
  document.querySelectorAll('.prompt-chip').forEach(button => {
    button.addEventListener('click', () => sendAIMessage(button.dataset.prompt || ''));
  });
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
  const sessionStats = getFocusStats();

  document.getElementById('dashboard-greeting').textContent = `Welcome back, ${(currentUser?.name || 'Student').split(' ')[0]}`;
  document.getElementById('dashboard-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('today-plan-date').textContent = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
  document.getElementById('stat-subjects').textContent = subjects.length;
  document.getElementById('stat-tasks').textContent = tasks.length;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-due').textContent = dueSoon.length;
  document.getElementById('stat-focus-minutes').textContent = sessionStats.minutes;
  document.getElementById('stat-streak').textContent = sessionStats.streak;
  const heroPresence = document.getElementById('hero-presence-copy');
  if (heroPresence) {
    if (subjects.length === 0) {
      heroPresence.textContent = 'Add a subject to open your first learning orbit';
    } else if (tasks.filter(task => !task.completed).length === 0) {
      heroPresence.textContent = `${subjects.length} learning orbit${subjects.length === 1 ? '' : 's'} · space to begin something new`;
    } else {
      const openTasks = tasks.filter(task => !task.completed).length;
      heroPresence.textContent = `${subjects.length} learning orbit${subjects.length === 1 ? '' : 's'} · ${openTasks} open question${openTasks === 1 ? '' : 's'}`;
    }
  }

  const list = document.getElementById('dashboard-due-list');
  const empty = document.getElementById('dashboard-due-empty');
  document.getElementById('dashboard-deadline-count').textContent = dueSoon.length;
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

  renderTodayPlan(tasks);
  renderSubjectProgress(subjects, tasks);
  renderCalendar(tasks);
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFocusStats() {
  const sessions = userSessions();
  const todayKey = getLocalDateKey(new Date());
  const todaySessions = sessions.filter(session => session.date === todayKey);
  const activeDays = new Set(sessions.map(session => session.date));
  const cursor = new Date();
  if (!activeDays.has(todayKey)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (activeDays.has(getLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    minutes: todaySessions.reduce((sum, session) => sum + (Number(session.minutes) || 0), 0),
    streak
  };
}

function renderTodayPlan(tasks) {
  const list = document.getElementById('today-plan-list');
  const empty = document.getElementById('today-plan-empty');
  const pending = tasks.filter(task => !task.completed).sort((a, b) => {
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    return a.deadline ? -1 : b.deadline ? 1 : 0;
  }).slice(0, 3);

  list.innerHTML = '';
  list.classList.toggle('hidden', pending.length === 0);
  empty.classList.toggle('hidden', pending.length > 0);

  pending.forEach((task, index) => {
    const subject = getSubject(task.subjectId);
    const item = document.createElement('article');
    item.className = 'today-plan-item';
    const deadline = task.deadline ? formatDeadline(task.deadline) : 'No deadline';
    item.innerHTML = `
      <span class="plan-order">${String(index + 1).padStart(2, '0')}</span>
      <span class="plan-color" style="--subject-color:${subject?.color || '#8476d8'}"></span>
      <div class="plan-task-copy">
        <h4>${escapeHtml(task.title)}</h4>
        <p>${escapeHtml(subject?.name || 'Unassigned')} <span>·</span> ${escapeHtml(deadline)}</p>
      </div>
      <span class="plan-duration">25 min focus</span>
    `;
    list.appendChild(item);
  });
}

function renderSubjectProgress(subjects, tasks) {
  const list = document.getElementById('dashboard-subject-progress');
  const empty = document.getElementById('dashboard-progress-empty');
  list.innerHTML = '';
  list.classList.toggle('hidden', subjects.length === 0);
  empty.classList.toggle('hidden', subjects.length > 0);

  subjects.slice(0, 5).forEach(subject => {
    const subjectTasks = tasks.filter(task => task.subjectId === subject.id);
    const completed = subjectTasks.filter(task => task.completed).length;
    const percent = subjectTasks.length ? Math.round(completed / subjectTasks.length * 100) : 0;
    const item = document.createElement('div');
    item.className = 'subject-progress-item';
    item.innerHTML = `
      <div class="subject-progress-heading">
        <span class="subject-progress-name"><span class="subject-progress-dot" style="--subject-color:${subject.color}"></span>${escapeHtml(subject.name)}</span>
        <span class="subject-progress-count">${completed}/${subjectTasks.length} complete</span>
      </div>
      <div class="progress-track" role="progressbar" aria-label="${escapeHtml(subject.name)} task completion" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
        <span style="--progress:${percent}%;--subject-color:${subject.color}"></span>
      </div>
    `;
    list.appendChild(item);
  });
}

function renderCalendar(tasks) {
  const label = document.getElementById('calendar-month-label');
  const grid = document.getElementById('dashboard-calendar');
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  label.textContent = calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const deadlines = new Map();
  tasks.filter(task => task.deadline).forEach(task => {
    const key = getLocalDateKey(new Date(task.deadline));
    if (!deadlines.has(key)) deadlines.set(key, []);
    deadlines.get(key).push(task.title);
  });

  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const todayKey = getLocalDateKey(new Date());
  const calendarStart = new Date(year, month, 1 - firstDayOffset);
  grid.innerHTML = '';

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const key = getLocalDateKey(date);
    const taskTitles = deadlines.get(key) || [];
    const cell = document.createElement('div');
    const classes = ['calendar-day'];
    if (date.getMonth() !== month) classes.push('other-month');
    if (key === todayKey) classes.push('is-today');
    if (taskTitles.length) classes.push('has-deadline');
    cell.className = classes.join(' ');
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${taskTitles.length ? `, ${taskTitles.length} task deadline${taskTitles.length === 1 ? '' : 's'}: ${taskTitles.join(', ')}` : ''}`);
    cell.innerHTML = `<span class="calendar-day-number">${date.getDate()}</span>${taskTitles.length ? '<span class="calendar-deadline-dot" aria-hidden="true"></span>' : ''}`;
    grid.appendChild(cell);
  }
}

function updateFocusTimer() {
  const minutes = Math.floor(focusRemaining / 60);
  const seconds = focusRemaining % 60;
  document.getElementById('focus-clock').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  document.getElementById('focus-ring').style.setProperty('--focus-progress', `${((focusDuration - focusRemaining) / focusDuration) * 100}%`);
  const button = document.getElementById('btn-focus-toggle');
  button.textContent = focusInterval ? 'Pause session' : focusRemaining < focusDuration ? 'Resume session' : 'Start session';
}

function finishFocusSession() {
  window.clearInterval(focusInterval);
  focusInterval = null;
  focusEndsAt = null;
  focusRemaining = 0;
  const sessions = userSessions();
  sessions.push({ id: id(), date: getLocalDateKey(new Date()), minutes: 25 });
  setUserSessions(sessions);
  updateFocusTimer();
  document.getElementById('focus-session-status').textContent = 'Session complete. Your focus time and streak have been updated.';
  renderDashboard();
}

function toggleFocusSession() {
  if (focusInterval) {
    window.clearInterval(focusInterval);
    focusInterval = null;
    updateFocusTimer();
    return;
  }
  if (focusRemaining === 0) focusRemaining = focusDuration;
  document.getElementById('focus-session-status').textContent = '';
  window.dispatchEvent(new Event('study-space-pulse'));
  focusInterval = window.setInterval(() => {
    focusRemaining = Math.max(0, Math.ceil((focusEndsAt - Date.now()) / 1000));
    if (focusRemaining <= 0) finishFocusSession();
    else updateFocusTimer();
  }, 1000);
  focusEndsAt = Date.now() + focusRemaining * 1000;
  updateFocusTimer();
}

function resetFocusSession() {
  window.clearInterval(focusInterval);
  focusInterval = null;
  focusEndsAt = null;
  focusRemaining = focusDuration;
  document.getElementById('focus-session-status').textContent = '';
  updateFocusTimer();
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
      card.dataset.subjectId = s.id;
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
      row.dataset.taskId = t.id;
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
  if (n) {
    n.classList.add('active');
    n.setAttribute('aria-current', 'page');
  }
  if (bn) {
    bn.classList.add('active');
    bn.setAttribute('aria-current', 'page');
  }
  document.querySelectorAll(`.nav-item:not([data-view="${name}"])`).forEach(item => item.removeAttribute('aria-current'));
  document.querySelectorAll(`.bottom-nav-item:not([data-view="${name}"])`).forEach(item => item.removeAttribute('aria-current'));
  renderAll();
}

function applyTheme(theme) {
  const selectedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selectedTheme;
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    const nextTheme = selectedTheme === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
    toggle.title = `Switch to ${nextTheme} theme`;
    document.getElementById('theme-toggle-label').textContent = `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} mode`;
  }
}

function closeGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const results = document.getElementById('global-search-results');
  results.classList.add('hidden');
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}

function renderGlobalSearch(value) {
  const input = document.getElementById('global-search-input');
  const results = document.getElementById('global-search-results');
  const query = value.trim().toLowerCase();
  results.replaceChildren();
  input.removeAttribute('aria-activedescendant');
  if (!query) {
    closeGlobalSearch();
    return;
  }

  const pages = [
    { type: 'page', id: 'dashboard', title: 'Dashboard', detail: 'Your study overview' },
    { type: 'page', id: 'subjects', title: 'Subjects', detail: 'Manage your subjects' },
    { type: 'page', id: 'tasks', title: 'Tasks', detail: 'Browse and organize tasks' },
    { type: 'page', id: 'ai', title: 'AI Study Assistant', detail: 'Get help with your study plan' }
  ];
  const matches = pages
    .filter(item => `${item.title} ${item.detail}`.toLowerCase().includes(query))
    .map(item => ({ ...item, group: 'Pages' }));

  userSubjects().forEach(subject => {
    const tasks = userTasks().filter(task => task.subjectId === subject.id);
    if (`${subject.name} subject`.toLowerCase().includes(query)) {
      matches.push({
        type: 'subject',
        id: subject.id,
        title: subject.name,
        detail: `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`,
        group: 'Subjects'
      });
    }
    tasks.forEach(task => {
      const subjectName = subject.name;
      if (`${task.title} ${subjectName}`.toLowerCase().includes(query)) {
        matches.push({
          type: 'task',
          id: task.id,
          title: task.title,
          detail: `${subjectName}${task.completed ? ' · Completed' : ''}`,
          group: 'Tasks'
        });
      }
    });
  });

  const visibleMatches = matches.slice(0, 10);
  if (visibleMatches.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'search-empty';
    empty.setAttribute('role', 'status');
    empty.textContent = `No matches for “${value.trim()}”. Try a task, subject, or page name.`;
    results.appendChild(empty);
  } else {
    let currentGroup = '';
    visibleMatches.forEach((match, index) => {
      if (match.group !== currentGroup) {
        currentGroup = match.group;
        const heading = document.createElement('p');
        heading.className = 'search-group';
        heading.textContent = currentGroup;
        results.appendChild(heading);
      }
      const option = document.createElement('button');
      option.type = 'button';
      option.id = `global-search-option-${index}`;
      option.className = 'search-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.dataset.index = index;
      option.dataset.type = match.type;
      option.dataset.id = match.id;
      const copy = document.createElement('span');
      copy.className = 'search-option-copy';
      const title = document.createElement('strong');
      title.textContent = match.title;
      const detail = document.createElement('small');
      detail.textContent = match.detail;
      copy.append(title, detail);
      const type = document.createElement('span');
      type.className = 'search-option-type';
      type.textContent = match.type === 'page' ? 'Open' : 'View';
      option.append(copy, type);
      results.appendChild(option);
    });
  }

  results.classList.remove('hidden');
  input.setAttribute('aria-expanded', 'true');
}

function activateGlobalSearchResult(option) {
  const { type, id: resultId } = option.dataset;
  closeGlobalSearch();
  document.getElementById('global-search-input').value = '';
  if (type === 'page') {
    setView(resultId);
    return;
  }

  const view = type === 'subject' ? 'subjects' : 'tasks';
  setView(view);
  if (type === 'subject') {
    const card = document.querySelector(`[data-subject-id="${CSS.escape(resultId)}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (card) {
      card.classList.add('search-highlight');
      window.setTimeout(() => card.classList.remove('search-highlight'), 1500);
    }
    return;
  }

  document.querySelector('.filter-tab[data-filter="all"]')?.click();
  const subjectFilter = document.getElementById('filter-subject');
  subjectFilter.value = '';
  renderTasks();
  const row = document.querySelector(`[data-task-id="${CSS.escape(resultId)}"]`);
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (row) {
    row.classList.add('search-highlight');
    window.setTimeout(() => row.classList.remove('search-highlight'), 1500);
  }
}

function setSearchActiveOption(index) {
  const input = document.getElementById('global-search-input');
  const options = [...document.querySelectorAll('#global-search-results .search-option')];
  if (options.length === 0) return;
  const activeIndex = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => {
    const active = optionIndex === activeIndex;
    option.setAttribute('aria-selected', String(active));
    if (active) {
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });
}

/* ========== Event wiring ========== */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem(STORAGE.theme) || 'dark');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
      console.warn('Offline support could not be enabled.', error);
    });
  }
  loadSession();
  initializeAIChat();
  updateFocusTimer();

  document.getElementById('global-search-input')?.addEventListener('input', event => {
    renderGlobalSearch(event.currentTarget.value);
  });
  document.getElementById('global-search-input')?.addEventListener('focus', event => {
    if (event.currentTarget.value.trim()) renderGlobalSearch(event.currentTarget.value);
  });
  document.getElementById('global-search-input')?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const options = [...document.querySelectorAll('#global-search-results .search-option')];
      const active = options
        .findIndex(option => option.getAttribute('aria-selected') === 'true');
      const next = active < 0
        ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
        : active + (event.key === 'ArrowDown' ? 1 : -1);
      setSearchActiveOption(next);
    } else if (event.key === 'Enter') {
      const active = document.querySelector('#global-search-results .search-option[aria-selected="true"]')
        || document.querySelector('#global-search-results .search-option');
      if (active) {
        event.preventDefault();
        activateGlobalSearchResult(active);
      }
    } else if (event.key === 'Escape') {
      closeGlobalSearch();
      event.currentTarget.blur();
    }
  });
  document.getElementById('global-search-results')?.addEventListener('click', event => {
    const option = event.target.closest('.search-option');
    if (option) activateGlobalSearchResult(option);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.global-search')) closeGlobalSearch();
  });
  document.addEventListener('keydown', event => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement
      && (target.isContentEditable || target.matches('input, textarea, select'));
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('global-search-input').focus();
    } else if (event.key === '/' && !isTyping && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      document.getElementById('global-search-input').focus();
    }
  });
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE.theme, nextTheme);
    applyTheme(nextTheme);
  });
  document.getElementById('btn-topbar-add-task')?.addEventListener('click', () => {
    setView('tasks');
    openTaskModal();
  });
  document.getElementById('btn-hero-focus')?.addEventListener('click', () => {
    if (!focusInterval) toggleFocusSession();
    document.getElementById('focus-ring').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('btn-sidebar-focus')?.addEventListener('click', () => {
    setView('dashboard');
    if (!focusInterval) toggleFocusSession();
    document.getElementById('focus-ring').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('btn-hero-ai')?.addEventListener('click', () => setView('ai'));

  document.getElementById('btn-dashboard-add-task')?.addEventListener('click', () => {
    setView('tasks');
    openTaskModal();
  });
  document.getElementById('btn-dashboard-add-subject')?.addEventListener('click', () => {
    setView('subjects');
    openSubjectModal();
  });
  document.getElementById('btn-focus-toggle')?.addEventListener('click', toggleFocusSession);
  document.getElementById('btn-focus-reset')?.addEventListener('click', resetFocusSession);
  document.getElementById('calendar-prev')?.addEventListener('click', () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar(userTasks());
  });
  document.getElementById('calendar-next')?.addEventListener('click', () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendar(userTasks());
  });
  document.querySelectorAll('.panel-link[data-view]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      setView(link.dataset.view);
    });
  });

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
