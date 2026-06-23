/* ════════════════════════════════════════════════════
   FlashIFCE — script.js
   JavaScript puro, sem dependências externas.
   Dados persistidos no localStorage por usuário.
════════════════════════════════════════════════════ */

/* ════════════════════════════
   1. ESTADO GLOBAL
════════════════════════════ */
let currentUser   = null;   // objeto { name, username, password }
let subjects      = [];     // array de matérias do usuário logado
let activeSubject = null;   // matéria aberta no momento (ou null = "todos")
let editingCardId = null;   // id do flashcard em edição (null = novo)
let editingSubjectId = null;// id da matéria em edição (null = nova)
let selectedIcon  = '📚';  // ícone selecionado no modal de matéria
let studiedToday  = 0;      // contador de cartões virados hoje
let deleteTarget  = null;   // { type: 'card'|'subject', id }

// ── Ícones disponíveis para matérias ──
const SUBJECT_ICONS = [
  '📚','📖','✏️','📝','🧮','🔬','🧬','⚗️','🧪','🌍','🗺️',
  '📐','📏','🖊️','🖋️','📜','🏛️','⚖️','🧠','💡','🔭','🎨',
  '🎵','🎶','🏃','⚽','🏋️','🩺','💊','🖥️','💻','📱','🌐',
  '🇧🇷','🗣️','📊','📈','💰','🏦','🌱','🌿','🌳','🔢','🔣',
];

// ── Chaves do localStorage ──
const LS_USERS   = 'flashifce_users';
const LS_SESSION = 'flashifce_session';
const LS_DATA    = (username) => `flashifce_data_${username}`;
const LS_STUDIED = (username) => `flashifce_studied_${username}`;


/* ════════════════════════════
   2. INICIALIZAÇÃO
════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem('flashifce_theme') || 'light');
  buildIconPicker();
  tryAutoLogin();
});

// Tenta restaurar sessão salva
function tryAutoLogin() {
  const saved = localStorage.getItem(LS_SESSION);
  if (saved) {
    const users = getUsers();
    const user  = users.find(u => u.username === saved);
    if (user) { loginSuccess(user); return; }
  }
  showAuthScreen();
}


/* ════════════════════════════
   3. PERSISTÊNCIA (localStorage)
════════════════════════════ */

// Retorna array de todos os usuários cadastrados
function getUsers() {
  try {
    const raw = localStorage.getItem(LS_USERS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Salva array de usuários
function saveUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

// Carrega matérias do usuário logado
function loadSubjects() {
  try {
    const raw = localStorage.getItem(LS_DATA(currentUser.username));
    const parsed = raw ? JSON.parse(raw) : [];
    subjects = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    subjects = [];
  }
}

// Persiste matérias do usuário logado
function saveSubjects() {
  localStorage.setItem(LS_DATA(currentUser.username), JSON.stringify(subjects));
}

// Carrega e retorna quantos cartões foram virados hoje
function loadStudiedToday() {
  try {
    const raw = localStorage.getItem(LS_STUDIED(currentUser.username));
    if (!raw) { studiedToday = 0; return; }
    const obj = JSON.parse(raw);
    const today = new Date().toDateString();
    studiedToday = obj.date === today ? obj.count : 0;
  } catch (e) {
    studiedToday = 0;
  }
}

// Salva contagem de cartões virados
function saveStudiedToday() {
  localStorage.setItem(LS_STUDIED(currentUser.username), JSON.stringify({
    date: new Date().toDateString(),
    count: studiedToday
  }));
}


/* ════════════════════════════
   4. AUTENTICAÇÃO
════════════════════════════ */

// Alterna entre as abas login / register / forgot
function switchTab(tab) {
  // Esconde todos os painéis
  ['login','register','forgot'].forEach(t => {
    document.getElementById(`panel-${t}`).classList.add('hidden');
  });
  document.getElementById(`panel-${tab}`).classList.remove('hidden');

  // Atualiza visual das abas (indicator)
  const tabs = document.querySelectorAll('.auth-tab');
  const indicator = document.getElementById('tab-indicator');
  tabs.forEach(t => t.classList.remove('auth-tab--active'));

  // Só as abas "login" e "register" têm botão visível
  if (tab === 'login') {
    tabs[0].classList.add('auth-tab--active');
    indicator.style.width  = tabs[0].offsetWidth + 'px';
    indicator.style.transform = 'translateX(0)';
  } else if (tab === 'register') {
    tabs[1].classList.add('auth-tab--active');
    indicator.style.width  = tabs[1].offsetWidth + 'px';
    indicator.style.transform = `translateX(${tabs[0].offsetWidth}px)`;
  } else {
    // "forgot" não tem aba própria; esconde o indicator
    indicator.style.width = '0';
  }
}

// Cadastro de novo usuário
function handleRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const user = document.getElementById('reg-user').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('reg-error');

  if (!name || !user || !pass) return showError(errEl, 'Preencha todos os campos.');
  if (pass.length < 4)          return showError(errEl, 'Senha deve ter mínimo 4 caracteres.');

  const users = getUsers();
  if (users.find(u => u.username === user)) return showError(errEl, 'Usuário já existe. Escolha outro.');

  const newUser = { name, username: user, password: pass };
  users.push(newUser);
  saveUsers(users);

  errEl.classList.add('hidden');
  showToast('Conta criada! Faça login.', 'success');
  switchTab('login');
}

// Login
function handleLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  if (!user || !pass) return showError(errEl, 'Preencha usuário e senha.');

  const users  = getUsers();
  const found  = users.find(u => u.username === user && u.password === pass);
  if (!found) return showError(errEl, 'Usuário ou senha incorretos.');

  errEl.classList.add('hidden');
  localStorage.setItem(LS_SESSION, user);
  loginSuccess(found);
}

// Redefinição de senha
function handleForgot() {
  const user    = document.getElementById('forgot-user').value.trim();
  const newPass = document.getElementById('forgot-new-pass').value;
  const errEl   = document.getElementById('forgot-error');

  if (!user || !newPass) return showError(errEl, 'Preencha todos os campos.');
  if (newPass.length < 4) return showError(errEl, 'Senha deve ter mínimo 4 caracteres.');

  const users = getUsers();
  const idx   = users.findIndex(u => u.username === user);
  if (idx === -1) return showError(errEl, 'Usuário não encontrado.');

  users[idx].password = newPass;
  saveUsers(users);

  errEl.classList.add('hidden');
  showToast('Senha redefinida com sucesso!', 'success');
  switchTab('login');
}

// Logout
function handleLogout() {
  localStorage.removeItem(LS_SESSION);
  currentUser   = null;
  activeSubject = null;
  subjects      = [];
  studiedToday  = 0;
  resetTimer();
  showAuthScreen();
  showToast('Até logo!', 'info');
}

// Após login bem-sucedido: configura UI
function loginSuccess(user) {
  currentUser = user;
  loadSubjects();
  loadStudiedToday();

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('nav-greeting').textContent = `Olá, ${user.name.split(' ')[0]} 👋`;

  showSubjectsView();
  updateStats();
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  switchTab('login');
}


/* ════════════════════════════
   5. MATÉRIAS
════════════════════════════ */

// Abre modal para nova matéria
function openSubjectModal(id = null) {
  editingSubjectId = id;
  selectedIcon = '📚';

  const modal = document.getElementById('subject-modal');
  const title = document.getElementById('subject-modal-title');
  const input = document.getElementById('subject-name-input');

  if (id !== null) {
    // Edição: preenche campos existentes
    const subj = subjects.find(s => s.id === id);
    title.textContent  = 'Editar Matéria';
    input.value        = subj.name;
    selectedIcon       = subj.icon || '📚';
  } else {
    title.textContent = 'Nova Matéria';
    input.value       = '';
  }

  // Marca ícone selecionado no picker
  document.querySelectorAll('.icon-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.icon === selectedIcon);
  });

  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 100);
}

function closeSubjectModal() {
  document.getElementById('subject-modal').classList.add('hidden');
  editingSubjectId = null;
}

function closeSubjectModalOutside(e) {
  if (e.target === document.getElementById('subject-modal')) closeSubjectModal();
}

// Salva matéria (nova ou editada)
function saveSubject() {
  const name = document.getElementById('subject-name-input').value.trim();
  if (!name) { showToast('Digite o nome da matéria.', 'error'); return; }

  if (editingSubjectId !== null) {
    // Edição
    const subj = subjects.find(s => s.id === editingSubjectId);
    subj.name = name;
    subj.icon = selectedIcon;
  } else {
    // Nova
    subjects.push({
      id:    Date.now(),
      name,
      icon:  selectedIcon,
      cards: [],
    });
  }

  saveSubjects();
  closeSubjectModal();
  renderSubjects();
  updateStats();
  showToast(editingSubjectId !== null ? 'Matéria atualizada!' : 'Matéria criada!', 'success');
}

// Abre confirmação de exclusão de matéria
function deleteSubject(id, e) {
  e.stopPropagation(); // impede navegar para a matéria ao clicar em excluir
  const subj = subjects.find(s => s.id === id);
  deleteTarget = { type: 'subject', id };
  document.getElementById('delete-modal-title').textContent = 'Excluir matéria?';
  document.getElementById('delete-modal-desc').textContent =
    `"${subj.name}" e todos os ${subj.cards.length} cartão(ões) serão excluídos permanentemente.`;
  document.getElementById('delete-modal').classList.remove('hidden');
}

// Renderiza a grade de matérias
function renderSubjects(filter = '') {
  const grid   = document.getElementById('subjects-grid');
  const empty  = document.getElementById('subjects-empty-state');
  const label  = document.getElementById('subjects-count-label');
  const term   = filter.toLowerCase();

  const filtered = subjects.filter(s => s.name.toLowerCase().includes(term));

  label.textContent = `${subjects.length} matéria${subjects.length !== 1 ? 's' : ''}`;
  grid.innerHTML    = '';

  if (subjects.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach((subj, i) => {
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.style.animationDelay = `${i * 0.04}s`;
    card.onclick = () => openSubjectCards(subj.id);
    card.innerHTML = `
      <div class="subject-card__actions">
        <button class="card-action" onclick="openSubjectModal(${subj.id})" title="Editar">
          <svg viewBox="0 0 20 20" fill="none"><path d="M4 16l1-4L13 4l3 3-8 8-4 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </button>
        <button class="card-action card-action--delete" onclick="deleteSubject(${subj.id}, event)" title="Excluir">
          <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
      </div>
      <span class="subject-card__icon">${subj.icon || '📚'}</span>
      <div class="subject-card__name">${escapeHtml(subj.name)}</div>
      <div class="subject-card__count">
        <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M7 9h6M7 12h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        ${subj.cards.length} cartão${subj.cards.length !== 1 ? 'ões' : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

// Filtra matérias pelo campo de busca
function filterSubjects() {
  const term = document.getElementById('subject-search-input').value;
  renderSubjects(term);
}

// Abre "Todos os cartões" (sem matéria específica)
function openAllCards() {
  activeSubject = null;
  document.getElementById('active-subject-name').textContent = 'Todos os cartões';
  document.getElementById('active-subject-icon').textContent = '🗂️';

  const allCards = subjects.flatMap(s =>
    s.cards.map(c => ({ ...c, _subjectName: s.name }))
  );

  showCardsView(allCards, true);
}

// Abre cartões de uma matéria específica
function openSubjectCards(id) {
  const subj = subjects.find(s => s.id === id);
  activeSubject = id;
  document.getElementById('active-subject-name').textContent = subj.name;
  document.getElementById('active-subject-icon').textContent = subj.icon || '📚';
  showCardsView(subj.cards, false);
}

function showSubjectsView() {
  document.getElementById('view-subjects').classList.remove('hidden');
  document.getElementById('view-cards').classList.add('hidden');
  activeSubject = null;
  renderSubjects();
}

function goBackToSubjects() {
  showSubjectsView();
}


/* ════════════════════════════
   6. FLASHCARDS
════════════════════════════ */

// Mostra a view de cartões
function showCardsView(cards, readOnly = false) {
  document.getElementById('view-subjects').classList.add('hidden');
  document.getElementById('view-cards').classList.remove('hidden');
  document.getElementById('search-input').value = '';

  // Botão "Novo cartão": oculto em modo "todos os cartões"
  const btnNew = document.querySelector('#view-cards .btn--primary');
  btnNew.style.display = readOnly ? 'none' : '';

  document.getElementById('cards-count-label').textContent =
    `${cards.length} cartão${cards.length !== 1 ? 'ões' : ''} no baralho`;

  renderCards(cards);
}

// Renderiza grade de flashcards
function renderCards(cards, filter = '') {
  const grid  = document.getElementById('cards-grid');
  const empty = document.getElementById('empty-state');
  const term  = filter.toLowerCase();

  const filtered = cards.filter(c =>
    c.question.toLowerCase().includes(term) ||
    c.answer.toLowerCase().includes(term) ||
    (c.category || '').toLowerCase().includes(term)
  );

  grid.innerHTML = '';

  if (cards.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  filtered.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'flashcard';
    el.dataset.id = card.id;
    el.style.animationDelay = `${i * 0.04}s`;
    el.onclick = () => flipCard(el);

    const catHtml = card.category
      ? `<span class="flashcard__category">${escapeHtml(card.category)}</span>`
      : '';
    const subjectHtml = card._subjectName
      ? `<span class="flashcard__category">${escapeHtml(card._subjectName)}</span>`
      : catHtml;

    el.innerHTML = `
      <div class="flashcard__inner">
        <div class="flashcard__face flashcard__front">
          ${catHtml}
          <div class="flashcard__text">${escapeHtml(card.question)}</div>
          <div class="flashcard__hint">
            <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Clique para ver a resposta
          </div>
          ${activeSubject !== null ? `
          <div class="flashcard__actions">
            <button class="card-action" onclick="openCardModal(${card.id})" title="Editar">
              <svg viewBox="0 0 20 20" fill="none"><path d="M4 16l1-4L13 4l3 3-8 8-4 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            </button>
            <button class="card-action card-action--delete" onclick="deleteCard(${card.id})" title="Excluir">
              <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </button>
          </div>` : ''}
        </div>
        <div class="flashcard__face flashcard__back">
          ${subjectHtml}
          <div class="flashcard__text">${escapeHtml(card.answer)}</div>
          <div class="flashcard__hint">
            <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Clique para voltar
          </div>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });
}

// Vira um cartão (frente ↔ verso)
function flipCard(el) {
  // Não vira se clicar em botão de ação
  if (event.target.closest('.flashcard__actions')) return;
  el.classList.toggle('flipped');

  // Contabiliza estudo (apenas na primeira vez que vira para o verso)
  if (el.classList.contains('flipped') && !el.dataset.counted) {
    el.dataset.counted = '1';
    studiedToday++;
    saveStudiedToday();
    updateStats();
  }
}

// Filtra cartões pelo campo de busca
function filterCards() {
  const term = document.getElementById('search-input').value;
  const cards = activeSubject !== null
    ? subjects.find(s => s.id === activeSubject)?.cards || []
    : subjects.flatMap(s => s.cards.map(c => ({ ...c, _subjectName: s.name })));
  renderCards(cards, term);
}

// Abre modal de criação / edição de cartão
function openCardModal(id = null) {
  if (activeSubject === null) return; // modo "todos" não permite criar
  editingCardId = id;

  const modal = document.getElementById('card-modal');
  const title = document.getElementById('modal-title');

  if (id !== null) {
    const subj = subjects.find(s => s.id === activeSubject);
    const card = subj.cards.find(c => c.id === id);
    title.textContent = 'Editar Flashcard';
    document.getElementById('card-question').value  = card.question;
    document.getElementById('card-answer').value    = card.answer;
    document.getElementById('card-category').value  = card.category || '';
  } else {
    title.textContent = 'Novo Flashcard';
    document.getElementById('card-question').value  = '';
    document.getElementById('card-answer').value    = '';
    document.getElementById('card-category').value  = '';
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('card-question').focus(), 100);
}

function closeCardModal() {
  document.getElementById('card-modal').classList.add('hidden');
  editingCardId = null;
}

function closeCardModalOutside(e) {
  if (e.target === document.getElementById('card-modal')) closeCardModal();
}

// Salva flashcard (novo ou editado)
function saveCard() {
  const question = document.getElementById('card-question').value.trim();
  const answer   = document.getElementById('card-answer').value.trim();
  const category = document.getElementById('card-category').value.trim();

  if (!question || !answer) {
    showToast('Preencha a pergunta e a resposta.', 'error');
    return;
  }

  const subj = subjects.find(s => s.id === activeSubject);

  if (editingCardId !== null) {
    // Edição
    const card = subj.cards.find(c => c.id === editingCardId);
    card.question = question;
    card.answer   = answer;
    card.category = category;
  } else {
    // Novo
    subj.cards.push({ id: Date.now(), question, answer, category });
  }

  saveSubjects();
  closeCardModal();

  const label = document.getElementById('cards-count-label');
  label.textContent = `${subj.cards.length} cartão${subj.cards.length !== 1 ? 'ões' : ''} no baralho`;

  renderCards(subj.cards);
  updateStats();
  showToast(editingCardId !== null ? 'Cartão atualizado!' : 'Cartão criado!', 'success');
}

// Abre confirmação de exclusão de cartão
function deleteCard(id) {
  event.stopPropagation();
  deleteTarget = { type: 'card', id };
  document.getElementById('delete-modal-title').textContent = 'Excluir cartão?';
  document.getElementById('delete-modal-desc').textContent  = 'Esta ação não pode ser desfeita.';
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  deleteTarget = null;
}

function closeDeleteOutside(e) {
  if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
}

// Executa exclusão confirmada
function confirmDelete() {
  if (!deleteTarget) return;

  if (deleteTarget.type === 'subject') {
    const idx = subjects.findIndex(s => s.id === deleteTarget.id);
    if (idx !== -1) subjects.splice(idx, 1);
    saveSubjects();
    closeDeleteModal();
    renderSubjects();
    updateStats();
    showToast('Matéria excluída.', 'info');

  } else if (deleteTarget.type === 'card') {
    const subj = subjects.find(s => s.id === activeSubject);
    const idx  = subj.cards.findIndex(c => c.id === deleteTarget.id);
    if (idx !== -1) subj.cards.splice(idx, 1);
    saveSubjects();
    closeDeleteModal();
    renderCards(subj.cards);

    document.getElementById('cards-count-label').textContent =
      `${subj.cards.length} cartão${subj.cards.length !== 1 ? 'ões' : ''} no baralho`;

    updateStats();
    showToast('Cartão excluído.', 'info');
  }
}


/* ════════════════════════════
   7. ICON PICKER
════════════════════════════ */

function buildIconPicker() {
  const picker = document.getElementById('icon-picker');
  picker.innerHTML = '';
  SUBJECT_ICONS.forEach(icon => {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'icon-option';
    btn.dataset.icon = icon;
    btn.textContent = icon;
    btn.onclick     = () => selectIcon(icon, btn);
    picker.appendChild(btn);
  });
}

function selectIcon(icon, btn) {
  selectedIcon = icon;
  document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
  btn.classList.add('selected');
}


/* ════════════════════════════
   8. ESTATÍSTICAS
════════════════════════════ */
function updateStats() {
  const totalCards = subjects.reduce((acc, s) => acc + s.cards.length, 0);
  document.getElementById('stat-total').textContent    = totalCards;
  document.getElementById('stat-subjects').textContent = subjects.length;
  document.getElementById('stat-studied').textContent  = studiedToday;
}


/* ════════════════════════════
   9. CRONÔMETRO
════════════════════════════ */
let timerInterval  = null;
let timerTotal     = 25 * 60;  // segundos definidos no preset
let timerRemaining = 25 * 60;  // segundos restantes
let timerRunning   = false;

const CIRCUMFERENCE = 2 * Math.PI * 42; // ≈ 264 (r=42 do SVG)

function syncTimerInput() {
  // Lê os três inputs e recalcula o total/restante
  const h = parseInt(document.getElementById('t-hours').value)   || 0;
  const m = parseInt(document.getElementById('t-minutes').value) || 0;
  const s = parseInt(document.getElementById('t-seconds').value) || 0;
  timerTotal = timerRemaining = h * 3600 + m * 60 + s;
  updateTimerUI();
}

function setPreset(h, m, s) {
  if (timerRunning) return; // ignora preset com timer rodando
  timerTotal = timerRemaining = h * 3600 + m * 60 + s;

  document.getElementById('t-hours').value   = String(h).padStart(2,'0');
  document.getElementById('t-minutes').value = String(m).padStart(2,'0');
  document.getElementById('t-seconds').value = String(s).padStart(2,'0');

  // Destaca preset ativo
  document.querySelectorAll('.timer-preset').forEach(btn => {
    btn.classList.remove('timer-preset--active');
  });
  event.target.classList.add('timer-preset--active');

  updateTimerUI();
}

function startTimer() {
  if (timerRemaining <= 0 || timerRunning) return;
  timerRunning = true;
  setTimerInputsDisabled(true);

  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  document.getElementById('timer-ring-fill').classList.add('running');

  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimerUI();
    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      setTimerInputsDisabled(false);
      document.getElementById('btn-start').disabled = false;
      document.getElementById('btn-pause').disabled = true;
      document.getElementById('timer-ring-fill').classList.remove('running');
      openAlarm();
    }
  }, 1000);
}

function pauseTimer() {
  if (!timerRunning) return;
  timerRunning = false;
  clearInterval(timerInterval);
  setTimerInputsDisabled(false);
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  document.getElementById('timer-ring-fill').classList.remove('running');
}

function resetTimer() {
  pauseTimer();
  timerRemaining = timerTotal;
  updateTimerUI();
}

// Atualiza visualmente: inputs, anel SVG e label central
function updateTimerUI() {
  const h = Math.floor(timerRemaining / 3600);
  const m = Math.floor((timerRemaining % 3600) / 60);
  const s = timerRemaining % 60;

  if (!timerRunning) {
    // Só atualiza inputs quando parado (evita conflito com digitação)
    document.getElementById('t-hours').value   = String(h).padStart(2,'0');
    document.getElementById('t-minutes').value = String(m).padStart(2,'0');
    document.getElementById('t-seconds').value = String(s).padStart(2,'0');
  }

  // Label central do anel
  const label = h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  document.getElementById('timer-ring-label').textContent = label;

  // Progresso do anel: quanto já passou
  const progress = timerTotal > 0 ? timerRemaining / timerTotal : 1;
  const offset   = CIRCUMFERENCE * (1 - progress);
  document.getElementById('timer-ring-fill').style.strokeDashoffset = offset;
}

function setTimerInputsDisabled(disabled) {
  ['t-hours','t-minutes','t-seconds'].forEach(id => {
    document.getElementById(id).disabled = disabled;
  });
}

function openAlarm() {
  document.getElementById('alarm-modal').classList.remove('hidden');
  // Tenta disparar som de sistema (vibração em mobile, se suportado)
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
}

function closeAlarm() {
  document.getElementById('alarm-modal').classList.add('hidden');
}


/* ════════════════════════════
   10. TEMA (claro / escuro)
════════════════════════════ */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('flashifce_theme', next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}


/* ════════════════════════════
   11. TOAST NOTIFICATIONS
════════════════════════════ */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  // Remove após 3 segundos com animação de saída
  setTimeout(() => {
    toast.classList.add('toast--out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}


/* ════════════════════════════
   12. UTILITÁRIOS
════════════════════════════ */

// Exibe mensagem de erro em um elemento
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// Escapa caracteres HTML para evitar XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Alterna visibilidade da senha
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.querySelector('.eye-open').classList.toggle('hidden', isPass);
  btn.querySelector('.eye-closed').classList.toggle('hidden', !isPass);
}