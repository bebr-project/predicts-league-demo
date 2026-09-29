import { marketsFor, requiredStake, balanceFor, validateBet, optionFor, betWon } from './core.js';
import { STARTER_REACTIONS, DEMO_ACHIEVEMENTS, achievementProgress, unlockedReactions, toggleReaction } from './gamification.js';

const STORAGE_KEY = 'predicts_portfolio_demo_v1';
const HOUR = 3_600_000;
const kickoff = hours => new Date(Date.now() + hours * HOUR).toISOString();
const matches = [
  { id: 'm1', home: 'Атлас', away: 'Север', kickoff: kickoff(-54), status: 'FT', score: [2, 1], odds: [1.9, 3.35, 4.1] },
  { id: 'm2', home: 'Орион', away: 'Луна', kickoff: kickoff(-28), status: 'FT', score: [1, 1], odds: [2.18, 3.1, 3.25] },
  { id: 'm3', home: 'Гранит', away: 'Волна', kickoff: kickoff(3), status: 'NS', odds: [1.78, 3.55, 4.8] },
  { id: 'm4', home: 'Искра', away: 'Парус', kickoff: kickoff(16), status: 'NS', odds: [2.35, 3.15, 2.9] },
  { id: 'm5', home: 'Север', away: 'Орион', kickoff: kickoff(30), status: 'NS', odds: [2.03, 3.25, 3.6] },
  { id: 'm6', home: 'Луна', away: 'Атлас', kickoff: kickoff(52), status: 'NS', odds: [2.85, 3.3, 2.34] },
  { id: 'm7', home: 'Волна', away: 'Искра', kickoff: kickoff(74), status: 'NS', odds: [2.48, 3.05, 2.8] },
  { id: 'm8', home: 'Парус', away: 'Гранит', kickoff: kickoff(98), status: 'NS', odds: [3.2, 3.25, 2.14] }
];
const people = [
  { id: 'you', name: 'Вы', avatar: 'В' },
  { id: 'anna', name: 'Аня', avatar: 'А', favoriteClub: 'Луна' },
  { id: 'mark', name: 'Марк', avatar: 'М', favoriteClub: 'Гранит' },
  { id: 'lena', name: 'Лена', avatar: 'Л', favoriteClub: 'Волна' },
  { id: 'tim', name: 'Тимур', avatar: 'Т', favoriteClub: 'Север' }
];
const clubs = [...new Set(matches.flatMap(match => [match.home, match.away]))];
const seed = () => ({
  profile: { favoriteClub: 'Атлас' },
  bets: {
    you: { m1: { outcome: 'P1', stake: 70 } },
    anna: { m1: { outcome: 'P1', stake: 90 }, m2: { outcome: 'X', stake: 70 }, m3: { outcome: 'P1', stake: 100 } },
    mark: { m1: { outcome: 'P2', stake: 70 }, m2: { outcome: 'BTTS_YES', stake: 80 }, m4: { outcome: 'P1', stake: 70 } },
    lena: { m1: { outcome: 'BTTS_YES', stake: 70 }, m2: { outcome: 'X', stake: 70 } },
    tim: { m1: { outcome: 'P1', stake: 70 }, m2: { outcome: 'P1', stake: 70 }, m3: { outcome: 'DC_1X', stake: 90 } }
  },
  messages: [
    { id: 1, author: 'anna', text: 'В этом туре беру победу Гранита. Кто со мной?', time: '10:24', reactions: { mark: ['👏'] } },
    { id: 2, author: 'mark', text: 'Я пока смотрю на тотал в матче Искра — Парус.', time: '10:28', reactions: {} }
  ]
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object' && saved.bets && Array.isArray(saved.messages)) {
      const clean = seed();
      clean.profile.favoriteClub = clubs.includes(saved.profile?.favoriteClub) ? saved.profile.favoriteClub : clean.profile.favoriteClub;
      clean.bets.you = {};
      for (const match of matches) {
        const bet = saved.bets.you?.[match.id];
        if (bet && optionFor(match, bet.outcome) && Number.isInteger(bet.stake) && bet.stake > 0 && bet.stake <= 100_000) {
          clean.bets.you[match.id] = { outcome: bet.outcome, stake: bet.stake };
        }
      }
      clean.messages = saved.messages.slice(0, 100).filter(message => message && typeof message.text === 'string')
        .map(message => ({
          id: Number.isSafeInteger(message.id) ? message.id : 0,
          author: people.some(person => person.id === message.author) ? message.author : 'you',
          text: message.text.slice(0, 500),
          time: String(message.time || '').slice(0, 5),
          reactions: Object.fromEntries(people.map(person => {
            const raw = message.reactions?.[person.id];
            const legacy = Array.isArray(message.likes) && message.likes.includes(person.id) ? ['👏'] : [];
            return [person.id, Array.isArray(raw) ? raw.filter(emoji => [...STARTER_REACTIONS, ...DEMO_ACHIEVEMENTS.map(item => item.reward)].includes(emoji)).slice(0, 8) : legacy];
          }))
        }));
      return clean;
    }
  } catch { /* Private browsing may disable localStorage. */ }
  return seed();
}
let data = load();
let view = 'feed';
const ui = { expanded: null, market: {}, option: {}, stake: {}, day: null, picker: null };
const screen = document.querySelector('#screen');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const dateLabel = value => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const dayKey = value => new Date(value).toDateString();
const formatOdds = value => Number(value).toFixed(2);
const userBets = () => data.bets.you || (data.bets.you = {});

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* Demo remains usable in memory. */ }
}
function notice(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => toast.classList.remove('is-visible'), 3500);
}
function standings() {
  return people.map(person => ({ ...person, ...balanceFor(matches, data.bets[person.id] || {}) }))
    .sort((a, b) => b.settled - a.settled || a.name.localeCompare(b.name, 'ru'));
}
function pageHead(label, title, description) {
  return `<header class="page-head"><div><span class="eyebrow">${label}</span><h2>${title}</h2><p>${description}</p></div><span class="demo-pill">ДЕМО-ДАННЫЕ</span></header>`;
}
function badge(name) {
  const palette = ['#d4ff57', '#8be1d2', '#f3bb70', '#bca5ff', '#f6a4a8', '#a6cff8'];
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `<span class="team-badge" aria-hidden="true" style="background:${palette[hash % palette.length]}">${escapeHtml(name.slice(0, 1))}</span>`;
}
function favoriteLabel(person) {
  const club = person.id === 'you' ? data.profile.favoriteClub : person.favoriteClub;
  return club ? `<span class="favorite-club" title="Любимый клуб: ${escapeHtml(club)}">${badge(club)}<span>${escapeHtml(club)}</span></span>` : '';
}
function betSummary(match, bet) {
  if (!bet) return `<small>Ставка не сделана</small>`;
  const option = optionFor(match, bet.outcome);
  const result = match.status === 'FT' ? (betWon(match, bet.outcome) ? ' · выигрыш' : ' · проигрыш') : ' · зарезервировано';
  return `<small>${escapeHtml(option?.label || bet.outcome)} · ${escapeHtml(bet.stake)} очк.${result}</small>`;
}
function betEditor(match) {
  const markets = marketsFor(match);
  const saved = userBets()[match.id];
  const marketId = ui.market[match.id] || markets.find(item => item.options.some(option => option.id === saved?.outcome))?.id || 'outcome';
  const market = markets.find(item => item.id === marketId) || markets[0];
  const selection = ui.option[match.id] || saved?.outcome;
  const minimum = requiredStake(matches, userBets(), match.id);
  const stake = ui.stake[match.id] ?? saved?.stake ?? minimum;
  return `<div class="bet-panel" data-match-editor="${match.id}">
    <div class="market-tabs" role="group" aria-label="Тип прогноза">${markets.map(item => `<button type="button" class="market-tab ${item.id === market.id ? 'is-active' : ''}" data-action="market" data-match="${match.id}" data-market="${item.id}" aria-pressed="${item.id === market.id}">${item.label}</button>`).join('')}</div>
    <div class="options ${market.id === 'total' ? 'is-total' : ''}" role="group" aria-label="Вариант прогноза">${market.options.map(option => `<button type="button" class="option ${selection === option.id ? 'is-selected' : ''}" data-action="option" data-match="${match.id}" data-option="${option.id}" aria-pressed="${selection === option.id}"><span>${escapeHtml(option.label)}</span><strong>${formatOdds(option.odds)}</strong></button>`).join('')}</div>
    <div class="stake-row"><label for="stake-${match.id}">Ставка, очки</label><input id="stake-${match.id}" type="number" inputmode="numeric" min="${minimum}" step="1" value="${escapeHtml(stake)}" data-stake="${match.id}"><button type="button" class="button-primary" data-action="save-bet" data-match="${match.id}">${saved ? 'Изменить ставку' : 'Сохранить ставку'}</button></div>
    <p class="hint">Минимум сейчас: <strong>${minimum} очков</strong>. После каждого пропущенного матча минимум следующей ставки растёт на 70.</p>
  </div>`;
}
function matchCard(match) {
  const done = match.status === 'FT';
  const saved = userBets()[match.id];
  return `<article class="match-card ${done ? 'is-finished' : ''}">
    <div class="match-top"><span>ДЕМО-ТУР · ${dateLabel(match.kickoff)}</span><span class="status ${done ? 'done' : ''}">${done ? 'Завершён' : 'Предстоящий'}</span></div>
    <div class="teams"><div class="team">${badge(match.home)}<span>${escapeHtml(match.home)}</span></div><div class="score">${done ? `${match.score[0]} : ${match.score[1]}` : '— : —'}</div><div class="team away"><span>${escapeHtml(match.away)}</span>${badge(match.away)}</div></div>
    <div class="match-footer">${betSummary(match, saved)}${done ? '' : `<button type="button" data-action="toggle-bet" data-match="${match.id}" aria-expanded="${ui.expanded === match.id}">${ui.expanded === match.id ? 'Свернуть' : saved ? 'Изменить' : 'Сделать ставку'}</button>`}</div>
    ${ui.expanded === match.id && !done ? betEditor(match) : ''}
  </article>`;
}
function renderFeed() {
  const upcoming = matches.filter(match => match.status !== 'FT');
  const next = upcoming.find(match => !userBets()[match.id]) || upcoming[0];
  const minimum = requiredStake(matches, userBets(), next.id);
  return `${pageHead('ГЛАВНАЯ', 'Твой следующий прогноз', 'Небольшая лига, большие футбольные эмоции.')}
    <section class="hero"><div><span class="demo-pill">НЕДЕЛЯ 01 · УЧЕБНЫЙ ТУР</span><h3>Прогнозируй матчи. Соревнуйся с друзьями.</h3><p>Это автономная версия реального проекта: все команды, результаты и коэффициенты здесь вымышлены, а ставки идут только на демонстрационные очки.</p><button type="button" class="button-primary" data-view="matches">Открыть календарь <svg><use href="#i-arrow"/></svg></button></div><div class="hero-side"><div class="hero-stat"><span>Предстоящих матчей</span><strong>${upcoming.length}</strong></div><div class="hero-stat"><span>Минимум для следующей ставки</span><strong>${minimum} очков</strong></div></div></section>
    <div class="section-heading"><h3>Ближайшие матчи</h3><button type="button" data-view="matches">Все матчи →</button></div><div class="card-grid">${upcoming.slice(0, 4).map(matchCard).join('')}</div>
    <div class="section-heading"><h3>Больше, чем прогнозы</h3><span>Что есть в полной версии</span></div><div class="feature-grid"><article class="feature-card"><strong>Достижения и реакции</strong><p>Прогресс в лиге открывает новые эмодзи для чата. В демо эту механику можно испытать в профиле.</p><button type="button" data-view="profile">Открыть достижения →</button></article><article class="feature-card"><strong>Футбольный центр</strong><p>Календарь матчей, таблицы турниров, плей-офф, подробности матчей и профили клубов — в полном приложении.</p></article><article class="feature-card"><strong>Лига друзей</strong><p>Рейтинг, чат, персонализация профиля и управление турами объединены в одном месте.</p></article></div>`;
}
function renderMatches() {
  const days = [...new Set(matches.map(match => dayKey(match.kickoff)))];
  if (!ui.day || !days.includes(ui.day)) ui.day = days[0];
  const selected = matches.filter(match => dayKey(match.kickoff) === ui.day);
  return `${pageHead('КАЛЕНДАРЬ', 'Матчи тура', 'Выберите день и сделайте прогноз до начала матча.')}
    <div class="calendar" role="group" aria-label="Выбор дня">${days.map(day => { const date = new Date(day); return `<button type="button" class="day-button ${ui.day === day ? 'is-active' : ''}" data-action="day" data-day="${escapeHtml(day)}" aria-pressed="${ui.day === day}"><small>${new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date)}</small><strong>${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)}</strong></button>`; }).join('')}</div>
    <div class="card-grid">${selected.map(matchCard).join('')}</div>`;
}
function renderChat() {
  const available = unlockedReactions(userBets(), data.messages);
  const allEmojis = [...STARTER_REACTIONS, ...DEMO_ACHIEVEMENTS.map(item => item.reward)];
  return `${pageHead('ОБЩЕНИЕ', 'Чат лиги', 'За достижения открываются новые реакции. Сообщения хранятся только в этом браузере.')}
    <section class="panel"><div class="conversation">${data.messages.map(message => { const person = people.find(item => item.id === message.author); const mine = message.reactions?.you || []; const counts = allEmojis.map(emoji => ({ emoji, count: Object.values(message.reactions || {}).filter(list => Array.isArray(list) && list.includes(emoji)).length })).filter(item => item.count); const open = ui.picker === message.id; return `<article class="message ${message.author === 'you' ? 'mine' : ''}"><div class="message-head"><span class="message-author">${escapeHtml(person?.name || 'Участник')} ${favoriteLabel(person || people[0])}</span><time>${escapeHtml(message.time)}</time></div><p>${escapeHtml(message.text)}</p><div class="reaction-row">${counts.map(item => `<span class="reaction-count ${mine.includes(item.emoji) ? 'is-active' : ''}" aria-label="${item.count} реакций ${item.emoji}">${item.emoji} ${item.count}</span>`).join('')}<button type="button" class="reaction-trigger" data-action="picker" data-message="${message.id}" aria-expanded="${open}" aria-label="Добавить реакцию к сообщению ${escapeHtml(person?.name || 'участника')}">☺ +</button></div>${open ? `<div class="reaction-picker" role="group" aria-label="Выберите реакцию">${allEmojis.map(emoji => { const unlocked = available.includes(emoji); const goal = DEMO_ACHIEVEMENTS.find(item => item.reward === emoji); return `<button type="button" class="reaction-choice ${mine.includes(emoji) ? 'is-active' : ''}" data-action="reaction" data-message="${message.id}" data-emoji="${emoji}" aria-label="${unlocked ? 'Реакция' : `Закрыто: ${goal?.description}`} ${emoji}" aria-pressed="${mine.includes(emoji)}" title="${unlocked ? 'Реакция доступна' : `Откроется: ${goal?.description}`}" ${unlocked ? '' : 'disabled'}>${emoji}</button>`; }).join('')}</div>` : ''}</article>`; }).join('')}</div>
    <form id="chatForm" class="chat-form"><label for="chatText">Новое сообщение</label><textarea id="chatText" maxlength="500" required placeholder="Напишите сообщение. Enter — новая строка."></textarea><button type="submit" class="button-primary">Отправить</button></form></section>`;
}
function bracketPair(home, away, a, b, winner) {
  return `<div class="bracket-pair"><div class="${winner === home ? 'winner' : ''}"><span>${home}</span><span>${a}</span></div><div class="${winner === away ? 'winner' : ''}"><span>${away}</span><span>${b}</span></div></div>`;
}
function renderRanking() {
  const ranked = standings();
  return `${pageHead('ТАБЛИЦА', 'Рейтинг участников', 'Очки обновляются сразу после сохранения ставки или результата в демонстрационных данных.')}
    <div class="two-col"><section class="panel" aria-label="Таблица лиги">${ranked.map((person, index) => `<div class="leader-row"><span class="rank-no">${index + 1}</span><span class="avatar">${person.avatar}</span><span class="leader-main"><strong>${person.name} ${favoriteLabel(person)}</strong><small>${Object.keys(data.bets[person.id] || {}).length} прогнозов · ${person.reserved} зарезервировано</small></span><span class="leader-score">${person.settled}</span></div>`).join('')}</section>
    <aside class="panel"><h3>Как считаются очки</h3><p>В начале тура каждому начисляется по 100 очков за каждый матч. Ставка временно резервирует очки. После результата проигранная ставка списывается, а выигранная приносит выплату по коэффициенту.</p><div class="info-box"><p>В этом демо ${matches.length} матчей и ${people.length} участников. Результаты и коэффициенты вымышлены.</p></div></aside></div>
    <div class="section-heading"><h3>Путь к финалу</h3><span>Иллюстративная сетка · не live</span></div><div class="panel bracket" aria-label="Пример сетки плей-офф"><div class="bracket-stage"><h4>Четвертьфиналы</h4>${bracketPair('Атлас','Север',3,1,'Атлас')}${bracketPair('Луна','Орион',2,0,'Луна')}${bracketPair('Гранит','Волна',1,2,'Волна')}${bracketPair('Искра','Парус',2,1,'Искра')}</div><div class="bracket-stage"><h4>Полуфиналы</h4>${bracketPair('Атлас','Луна',2,1,'Атлас')}${bracketPair('Волна','Искра',0,3,'Искра')}</div><div class="bracket-stage"><h4>Финал</h4>${bracketPair('Атлас','Искра',2,1,'Атлас')}</div></div>`;
}
function renderProfile() {
  const balance = balanceFor(matches, userBets());
  const missed = matches.filter(match => match.status === 'FT' && !userBets()[match.id]).length;
  const achievements = achievementProgress(userBets(), data.messages);
  const unlockedCount = achievements.filter(item => item.unlocked).length;
  return `${pageHead('ПРОФИЛЬ', 'Ваше демо-пространство', 'Личные настройки и прогресс этой демонстрации.')}
    <div class="two-col"><section class="panel"><h3>Статистика</h3><dl class="profile-list"><div><dt>Всего матчей в туре</dt><dd>${matches.length}</dd></div><div><dt>Ваших прогнозов</dt><dd>${Object.keys(userBets()).length}</dd></div><div><dt>Пропущено завершённых матчей</dt><dd>${missed}</dd></div><div><dt>Текущий баланс</dt><dd>${balance.settled} очков</dd></div><div><dt>Доступно с учётом резерва</dt><dd>${balance.available} очков</dd></div></dl></section>
    <aside class="panel"><h3>Персонализация</h3><p>Любимый клуб показывается рядом с вашим именем в чате и рейтинге.</p><label class="field-label" for="favoriteClub">Предпочитаемый клуб</label><select id="favoriteClub" class="club-select">${clubs.map(club => `<option value="${escapeHtml(club)}" ${club === data.profile.favoriteClub ? 'selected' : ''}>${escapeHtml(club)}</option>`).join('')}</select><div class="identity-preview"><span>Так видят вас другие:</span><strong>Вы ${favoriteLabel(people[0])}</strong></div></aside></div>
    <section class="panel achievement-section"><div class="achievement-heading"><div><span class="eyebrow">ИГРОВОЙ ПРОГРЕСС</span><h3>Ветка достижений</h3><p>В полной версии достижений больше; здесь пороги сокращены, чтобы механику можно было попробовать за несколько минут.</p></div><span class="achievement-total">${unlockedCount} / ${achievements.length} открыто</span></div><div class="achievement-branches">${['Прогнозы', 'Общение'].map(branch => `<div class="achievement-branch"><h4>${branch}</h4><div class="achievement-nodes">${achievements.filter(item => item.branch === branch).map(item => `<div class="achievement-node ${item.unlocked ? 'is-unlocked' : 'is-locked'}"><span class="achievement-state">${item.unlocked ? 'ОТКРЫТО' : 'ПОКА ЗАКРЫТО'}</span><strong>${item.title}</strong><p>${item.description}</p><div class="achievement-bottom"><span>${item.current} / ${item.target}</span><span>Реакция ${item.reward}</span></div><div class="achievement-track"><span style="width:${Math.round(item.current / item.target * 100)}%"></span></div></div>`).join('')}</div></div>`).join('')}</div></section>
    <aside class="panel about-demo"><h3>Об этом демо</h3><p>Приложение не обращается к спортивным API и не хранит данные на сервере. Все изменения живут в localStorage браузера. Никакой регистрации и настоящих денег.</p><button type="button" class="button-secondary" data-action="reset"><svg><use href="#i-reset"/></svg> Сбросить демо</button></aside>`;
}
function render() {
  const ranked = standings();
  document.querySelector('#userIdentity').innerHTML = `Вы ${favoriteLabel(people[0])}`;
  document.querySelector('#mobileIdentity').innerHTML = `Вы ${favoriteLabel(people[0])}`;
  document.querySelector('#balanceText').textContent = balanceFor(matches, userBets()).available;
  document.querySelector('#leaderText').textContent = ranked[0]?.name || '—';
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  screen.innerHTML = ({ feed: renderFeed, matches: renderMatches, chat: renderChat, ranking: renderRanking, profile: renderProfile })[view]();
}

document.addEventListener('input', event => {
  const matchId = event.target.dataset.stake;
  if (matchId) ui.stake[matchId] = event.target.value;
});
document.addEventListener('change', event => {
  if (event.target.id !== 'favoriteClub' || !clubs.includes(event.target.value)) return;
  data.profile.favoriteClub = event.target.value;
  persist();
  render();
  notice(`Любимый клуб: ${event.target.value}.`);
});
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.view) {
    view = button.dataset.view;
    ui.expanded = null;
    ui.picker = null;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const { action, match: matchId } = button.dataset;
  if (!action) return;
  if (action === 'toggle-bet') ui.expanded = ui.expanded === matchId ? null : matchId;
  if (action === 'market') {
    ui.market[matchId] = button.dataset.market;
    ui.option[matchId] = null;
  }
  if (action === 'option') ui.option[matchId] = button.dataset.option;
  if (action === 'day') ui.day = button.dataset.day;
  if (action === 'picker') ui.picker = ui.picker === Number(button.dataset.message) ? null : Number(button.dataset.message);
  if (action === 'reaction') {
    const message = data.messages.find(item => String(item.id) === button.dataset.message);
    if (message) {
      message.reactions = toggleReaction(message.reactions, 'you', button.dataset.emoji, unlockedReactions(userBets(), data.messages));
      persist();
    }
  }
  if (action === 'save-bet') {
    const match = matches.find(item => item.id === matchId);
    const selected = ui.option[matchId] || userBets()[matchId]?.outcome;
    const stake = Number(ui.stake[matchId] ?? document.querySelector(`[data-stake="${matchId}"]`)?.value);
    const error = validateBet(matches, userBets(), matchId, selected, stake);
    if (error) { notice(error); return; }
    userBets()[matchId] = { outcome: selected, stake };
    persist();
    ui.expanded = null;
    notice(`Прогноз сохранён: ${match.home} — ${match.away}.`);
  }
  if (action === 'reset') {
    data = seed();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* In-memory reset still works. */ }
    ui.expanded = null;
    ui.stake = {};
    ui.option = {};
    ui.market = {};
    ui.picker = null;
    notice('Демонстрационные данные сброшены.');
  }
  render();
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'chatForm') return;
  event.preventDefault();
  const field = event.target.querySelector('textarea');
  const content = field.value.trim();
  if (!content) return;
  data.messages.push({ id: Date.now(), author: 'you', text: content.slice(0, 500), time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date()), reactions: {} });
  persist();
  render();
});

render();
