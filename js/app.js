// ============================================================
//  PokerChips.io — Full-Stack Client
//  Communicates with Vercel Serverless API + MongoDB
// ============================================================

// ====== LOCAL STATE ======
let gameCode = '';
let myName = '';
let myIdx = -1;
let gameData = null;
let pollTimer = null;
let raisePlayerIdx = -1;
let raiseAmount = 0;

const ROUNDS = [
  { name: 'Pre-flop', msg: '' },
  { name: 'Flop',     msg: '🃏 Deal 3 community cards face up' },
  { name: 'Turn',     msg: '🃏 Deal the 4th community card' },
  { name: 'River',    msg: '🃏 Deal the 5th and final card' },
  { name: 'Showdown', msg: '🏆 Reveal hands — award the pot!' }
];

function calcStartingBid(chips) { return Math.round(chips / 40); }

// ====== API HELPERS ======
const API = '';

async function apiPost(endpoint, body) {
  try {
    const res = await fetch(`${API}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Server error'); return null; }
    return data;
  } catch (err) {
    showToast('Connection error — check internet');
    console.error(err);
    return null;
  }
}

async function apiGet(endpoint) {
  try {
    const res = await fetch(`${API}/api/${endpoint}`);
    const data = await res.json();
    if (!res.ok) return null;
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ====== POLLING ======
function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!gameCode) return;
    const data = await apiGet(`game-state?code=${gameCode}`);
    if (data && data.game) {
      gameData = data.game;
      renderGame();
    }
  }, 2000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ====== PARTICLES ======
function spawnSuitParticles() {
  const suits = ['♠', '♥', '♦', '♣'];
  for (let i = 0; i < 10; i++) {
    const el = document.createElement('span');
    el.className = 'suit-particle';
    el.textContent = suits[Math.floor(Math.random() * suits.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (15 + Math.random() * 20) + 's';
    el.style.animationDelay = (Math.random() * 15) + 's';
    el.style.fontSize = (0.8 + Math.random() * 1) + 'rem';
    document.body.appendChild(el);
  }
}

// ====== TABS ======
function switchTab(tab, e) {
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`#tab-${tab}`).classList.add('active');
  if (e && e.target) { e.target.classList.add('active'); e.target.setAttribute('aria-selected','true'); }
}

function showView(showId, hideId) {
  const s = document.getElementById(showId), h = document.getElementById(hideId);
  h.classList.remove('visible'); h.classList.add('hidden');
  setTimeout(() => { s.classList.remove('hidden'); s.classList.add('visible'); }, 150);
}

// ====== BID DISPLAY ======
function updateBidDisplay() {
  const chips = parseInt(document.getElementById('start-chips').value);
  const el = document.getElementById('bid-display-value');
  if (el) el.textContent = calcStartingBid(chips);
}

// ====== CREATE GAME ======
async function createGame() {
  const name = document.getElementById('host-name').value.trim();
  if (!name) { showToast('Enter your name first!'); return; }
  const chips = parseInt(document.getElementById('start-chips').value);

  showToast('Creating game...');

  const data = await apiPost('create-game', { name, chips });
  if (!data) return;

  gameCode = data.code;
  myName = name;
  myIdx = 0;
  gameData = data.game;

  // Save to localStorage for reconnection
  localStorage.setItem('poker_name', myName);
  localStorage.setItem('poker_code', gameCode);

  showView('game-view', 'home-view');
  renderGame();
  startPolling();
  showToast('Game created! Share code: ' + gameCode);
}

// ====== JOIN GAME ======
async function joinGame() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('game-code-input').value.trim().toUpperCase();
  if (!name) { showToast('Enter your name!'); return; }
  if (!code) { showToast('Enter a game code!'); return; }

  showToast('Joining...');

  const data = await apiPost('join-game', { code, name });
  if (!data) return;

  gameCode = code;
  myName = name;
  myIdx = data.playerIdx;
  gameData = data.game;

  localStorage.setItem('poker_name', myName);
  localStorage.setItem('poker_code', gameCode);

  showView('game-view', 'home-view');
  renderGame();
  startPolling();
  showToast(`Joined the table!`);
}

// ====== SEND ACTION ======
async function sendAction(action, extra = {}) {
  const data = await apiPost('action', { code: gameCode, action, ...extra });
  if (data && data.game) {
    gameData = data.game;
    renderGame();
  }
  return data;
}

// ====== RENDER ======
function renderGame() {
  if (!gameData) return;

  document.getElementById('game-code-display').textContent = gameCode;
  document.getElementById('game-round-display').textContent = 'Hand ' + gameData.handNum;
  document.getElementById('pot-display').textContent = gameData.pot.toLocaleString();

  // Update my index (in case players array changed)
  myIdx = gameData.players.findIndex(p => p.name.toLowerCase() === myName.toLowerCase());

  renderRoundStepper();
  renderPlayers();
  renderLog();
}

function renderRoundStepper() {
  const container = document.getElementById('round-pills');
  container.innerHTML = '';
  ROUNDS.forEach((r, i) => {
    const pill = document.createElement('span');
    pill.className = 'round-pill' + (i === gameData.roundIdx ? ' active' : '') + (i < gameData.roundIdx ? ' done' : '');
    pill.textContent = r.name;
    container.appendChild(pill);
  });

  const btnText = document.getElementById('round-advance-text');
  if (gameData.roundIdx < ROUNDS.length - 1) {
    btnText.textContent = 'Next → ' + ROUNDS[gameData.roundIdx + 1].name;
  } else {
    btnText.textContent = 'End Hand';
  }
}

async function advanceRound() {
  const data = await sendAction('advance-round');
  if (data && data.game) {
    const r = ROUNDS[data.game.roundIdx];
    if (r && r.msg) {
      showTableMessage(r.msg);
      showToast(r.msg);
    }
  }
}

function showTableMessage(msg) {
  const el = document.getElementById('table-message');
  if (!msg) { el.classList.remove('visible'); return; }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), 6000);
}

function renderPlayers() {
  const grid = document.getElementById('players-grid');
  grid.innerHTML = '';

  gameData.players.forEach((p, i) => {
    const isDealer = i === gameData.dealerIdx;
    const isMe = p.name.toLowerCase() === myName.toLowerCase();
    const card = document.createElement('div');
    card.className = 'player-card' + (p.folded ? ' folded' : '');

    const initial = p.name.charAt(0).toUpperCase();

    // Debts HTML
    let debtsHtml = '';
    if (p.debts && p.debts.length > 0) {
      debtsHtml = '<div class="debt-section">';
      p.debts.forEach((d, di) => {
        const canCollect = d.from.toLowerCase() === myName.toLowerCase() && p.chips >= d.amount;
        debtsHtml += `<div class="debt-badge">
          <span class="debt-text">owes ${d.from}: ${d.amount}</span>
          ${canCollect ? `<button class="debt-collect-btn" onclick="doCollectDebt(${i})">Collect</button>` : ''}
        </div>`;
      });
      debtsHtml += '</div>';
    }

    // Loan button
    let loanBtn = '';
    if (!isMe && p.chips < gameData.startingBid) {
      loanBtn = `<button class="player-loan-btn" onclick="openLoanModal(${i})">💰 Loan</button>`;
    }

    // Action buttons
    let actionsHtml = '';
    if (!p.folded) {
      actionsHtml = `<div class="player-actions">
        <button class="p-act-btn p-fold" onclick="doFold(${i})">Fold</button>
        <button class="p-act-btn p-call" onclick="doCall(${i})">Call</button>
        <button class="p-act-btn p-raise" onclick="openRaise(${i})">Raise</button>
      </div>`;
    }

    card.innerHTML = `
      <div class="player-top">
        <div class="player-avatar">${initial}${isDealer ? '<span class="dealer-chip">D</span>' : ''}</div>
        <div><div class="player-name">${p.name}${isMe ? ' <span class="player-you-tag">(you)</span>' : ''}</div></div>
      </div>
      <div class="player-chips-row">
        <span class="player-chips-label">chips</span>
        <span class="player-chips">${p.chips.toLocaleString()}</span>
      </div>
      ${p.bet > 0 ? `<div class="player-bet-badge">bet: ${p.bet.toLocaleString()}</div>` : ''}
      <div class="player-folded-tag">FOLDED</div>
      ${debtsHtml}
      ${actionsHtml}
      ${loanBtn}
    `;
    grid.appendChild(card);
  });
}

function renderLog() {
  const el = document.getElementById('activity-log');
  if (!el || !gameData) return;
  el.innerHTML = '';

  if (!gameData.history || gameData.history.length === 0) {
    el.innerHTML = '<div class="log-entry"><span class="l-text" style="color:var(--muted)">No actions yet</span></div>';
    return;
  }

  gameData.history.slice(0, 15).forEach(e => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="l-time">${e.time}</span><span class="l-text">${e.text}</span>${e.amount !== null && e.amount !== undefined ? `<span class="l-amt">${Number(e.amount).toLocaleString()}</span>` : ''}`;
    el.appendChild(div);
  });
}

// ====== PLAYER ACTIONS ======
async function doFold(idx) {
  const p = gameData.players[idx];
  if (!p || p.folded) return;
  if (!confirm(`Fold ${p.name}?`)) return;
  const data = await sendAction('fold', { playerIdx: idx });
  if (data) {
    const active = data.game.players.filter(x => !x.folded);
    if (active.length === 1) {
      showToast(`${active[0].name} wins! 🏆`);
      launchConfetti();
    } else {
      showToast(`${p.name} folded`);
    }
  }
}

async function doCall(idx) {
  const p = gameData.players[idx];
  if (!p || p.folded) return;
  const data = await sendAction('call', { playerIdx: idx });
  if (data) {
    const maxBet = Math.max(...gameData.players.map(x => x.bet));
    if (p.bet >= maxBet) showToast(`${p.name} checks`);
    else showToast(`${p.name} calls`);
    bumpPot();
  }
}

// ====== RAISE PANEL ======
function openRaise(idx) {
  const p = gameData.players[idx];
  if (!p || p.folded) return;

  raisePlayerIdx = idx;
  raiseAmount = 0;

  document.getElementById('raise-for-name').textContent = p.name;
  document.getElementById('raise-max-info').textContent = `Max: ${p.chips.toLocaleString()}`;
  document.getElementById('raise-amount-display').textContent = '0';
  document.getElementById('raise-manual-input').value = '';
  document.getElementById('raise-panel').classList.add('visible');
  document.getElementById('raise-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeRaise() {
  document.getElementById('raise-panel').classList.remove('visible');
  raisePlayerIdx = -1;
}

function adjustRaise(delta) {
  if (raisePlayerIdx < 0) return;
  const p = gameData.players[raisePlayerIdx];
  raiseAmount = Math.max(0, Math.min(raiseAmount + delta, p.chips));
  document.getElementById('raise-amount-display').textContent = raiseAmount.toLocaleString();
  document.getElementById('raise-manual-input').value = raiseAmount;
}

function setRaiseManual() {
  if (raisePlayerIdx < 0) return;
  const p = gameData.players[raisePlayerIdx];
  const val = parseInt(document.getElementById('raise-manual-input').value) || 0;
  raiseAmount = Math.max(0, Math.min(val, p.chips));
  document.getElementById('raise-amount-display').textContent = raiseAmount.toLocaleString();
}

function raiseAllIn() {
  if (raisePlayerIdx < 0) return;
  const p = gameData.players[raisePlayerIdx];
  raiseAmount = p.chips;
  document.getElementById('raise-amount-display').textContent = raiseAmount.toLocaleString();
  document.getElementById('raise-manual-input').value = raiseAmount;
}

async function confirmRaise() {
  if (raisePlayerIdx < 0 || raiseAmount <= 0) { showToast('Enter an amount'); return; }
  const p = gameData.players[raisePlayerIdx];
  const data = await sendAction('raise', { playerIdx: raisePlayerIdx, amount: raiseAmount });
  if (data) {
    showToast(raiseAmount >= p.chips ? `${p.name} ALL IN!` : `${p.name} raises ${raiseAmount}`);
    bumpPot();
    closeRaise();
  }
}

function bumpPot() {
  const el = document.getElementById('pot-display');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

// ====== TAKE FROM POT ======
async function takeFromPot() {
  if (!gameData || gameData.pot <= 0) { showToast('Pot is empty'); return; }
  const name = prompt('Who gets the chips back?');
  if (!name) return;
  const amtStr = prompt(`Take how much from pot? (Pot: ${gameData.pot})`);
  const amt = parseInt(amtStr);
  if (!amt || amt <= 0) return;

  const data = await sendAction('take-from-pot', { targetName: name.trim(), amount: amt });
  if (data) showToast(`Chips returned!`);
}

// ====== NEW HAND ======
async function newHand() {
  if (gameData && gameData.pot > 0) {
    if (!confirm('Chips still in pot! Start new hand?')) return;
  }
  const data = await sendAction('new-hand');
  if (data) showToast(`Hand ${data.game.handNum} — bid posted`);
}

// ====== AWARD POT ======
function openAwardModal() {
  if (!gameData || gameData.pot <= 0) { showToast('Pot is empty'); return; }
  const modal = document.getElementById('award-modal');
  modal.classList.add('open');
  const opts = document.getElementById('winner-options');
  opts.innerHTML = '';
  document.getElementById('pot-award-display').textContent = gameData.pot.toLocaleString() + ' chips';

  gameData.players.forEach((p, i) => {
    if (!p.folded) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline';
      btn.style.marginBottom = '8px';
      btn.textContent = p.name + ' wins!';
      btn.onclick = async () => {
        const data = await sendAction('award-pot', { playerIdx: i });
        if (data) {
          showToast(`${p.name} wins! 🏆`);
          launchConfetti();
          closeAwardModal();
        }
      };
      opts.appendChild(btn);
    }
  });
}

function closeAwardModal() { document.getElementById('award-modal').classList.remove('open'); }

// ====== DEBT / LOAN ======
let loanTargetIdx = -1;

function openLoanModal(idx) {
  loanTargetIdx = idx;
  document.getElementById('loan-target-name').textContent = gameData.players[idx].name;
  document.getElementById('loan-amount').value = '';
  document.getElementById('loan-modal').classList.add('open');
  setTimeout(() => document.getElementById('loan-amount').focus(), 100);
}

function closeLoanModal() { document.getElementById('loan-modal').classList.remove('open'); loanTargetIdx = -1; }

async function confirmLoan() {
  if (loanTargetIdx < 0 || myIdx < 0) return;
  const amt = parseInt(document.getElementById('loan-amount').value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount'); return; }

  const data = await sendAction('loan', { playerIdx: myIdx, targetIdx: loanTargetIdx, amount: amt });
  if (data) {
    showToast(`Loaned ${amt} chips`);
    closeLoanModal();
  }
}

async function doCollectDebt(borrowerIdx) {
  if (myIdx < 0) return;
  const data = await sendAction('collect-debt', { playerIdx: myIdx, targetIdx: borrowerIdx });
  if (data) showToast('Debt collected!');
}

// ====== LEAVE ======
function leaveGame() {
  if (!confirm('Leave the game?')) return;
  stopPolling();
  gameCode = '';
  gameData = null;
  localStorage.removeItem('poker_code');
  showView('home-view', 'game-view');
}

// ====== SHARE ======
function copyCode() {
  const text = `Join my poker game! Code: ${gameCode}\n${window.location.origin}`;
  if (navigator.share) {
    navigator.share({ title: 'PokerChips.io', text, url: window.location.origin }).catch(() => fallbackCopy());
  } else { fallbackCopy(); }
}
function fallbackCopy() {
  navigator.clipboard.writeText(gameCode).catch(() => {});
  showToast('Code copied: ' + gameCode);
}

// ====== CONFETTI ======
function launchConfetti() {
  const colors = ['#c9a84c', '#e8c96b', '#c0392b', '#2563b8', '#1a6b3a', '#f2ede0'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + 'vw'; p.style.top = '-10px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDuration = (1.2 + Math.random()) + 's';
    p.style.animationDelay = (Math.random() * 0.5) + 's';
    const sz = 5 + Math.random() * 5;
    p.style.width = sz + 'px'; p.style.height = sz + 'px';
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2500);
  }
}

// ====== TOAST ======
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => {
  spawnSuitParticles();
  document.getElementById('home-view').classList.add('visible');

  const cs = document.getElementById('start-chips');
  if (cs) { cs.addEventListener('change', updateBidDisplay); updateBidDisplay(); }

  const loanInput = document.getElementById('loan-amount');
  if (loanInput) loanInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmLoan(); });

  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      closeRaise();
    }
  });

  // Try auto-rejoin from saved state
  const savedName = localStorage.getItem('poker_name');
  const savedCode = localStorage.getItem('poker_code');
  if (savedName && savedCode) {
    document.getElementById('join-name').value = savedName;
    document.getElementById('game-code-input').value = savedCode;
  }
});
