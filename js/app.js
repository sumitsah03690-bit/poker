// ============================================================
//  PokerChips.io — Free Turn, Own-Player Controls
//  Anyone acts anytime, but only for themselves
// ============================================================

let gameCode = '';
let myName = '';
let gameData = null;
let pollTimer = null;
let raiseAmount = 0;
let isHost = false;

const ROUNDS = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];

// ====== API ======
async function apiPost(ep, body) {
  try {
    const r = await fetch(`/api/${ep}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { showToast(d.error || 'Error'); return null; }
    return d;
  } catch (e) { showToast('Connection error'); return null; }
}

async function apiGet(ep) {
  try { const r = await fetch(`/api/${ep}`); if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; }
}

// ====== POLLING ======
function startPolling() { stopPolling(); poll(); pollTimer = setInterval(poll, 2000); }
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

async function poll() {
  if (!gameCode) return;
  const d = await apiGet(`game-state?code=${gameCode}`);
  if (d && d.game) {
    const oldRound = gameData ? gameData.roundIdx : -1;
    gameData = d.game;
    renderGame();
    if (d.game.roundMessage && d.game.roundIdx !== oldRound) {
      showTableMessage(d.game.roundMessage);
    }
  }
}

// ====== PARTICLES ======
function spawnSuitParticles() {
  const suits = ['♠', '♥', '♦', '♣'];
  for (let i = 0; i < 8; i++) {
    const el = document.createElement('span');
    el.className = 'suit-particle';
    el.textContent = suits[Math.floor(Math.random() * suits.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (15 + Math.random() * 20) + 's';
    el.style.animationDelay = (Math.random() * 15) + 's';
    document.body.appendChild(el);
  }
}

// ====== TABS & VIEWS ======
function switchTab(tab, e) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (e && e.target) e.target.classList.add('active');
}

function showView(show, hide) {
  const s = document.getElementById(show), h = document.getElementById(hide);
  h.classList.remove('visible'); h.classList.add('hidden');
  setTimeout(() => { s.classList.remove('hidden'); s.classList.add('visible'); }, 150);
}

function updateBidDisplay() {
  const el = document.getElementById('bid-display-value');
  if (el) el.textContent = Math.round(parseInt(document.getElementById('start-chips').value) / 40);
}

// ====== CREATE ======
async function createGame() {
  const name = document.getElementById('host-name').value.trim();
  if (!name) { showToast('Enter your name!'); return; }
  showToast('Creating...');
  const d = await apiPost('create-game', { name, chips: parseInt(document.getElementById('start-chips').value) });
  if (!d) return;
  gameCode = d.code; myName = name; gameData = d.game; isHost = true;
  localStorage.setItem('poker_name', myName);
  localStorage.setItem('poker_code', gameCode);
  localStorage.setItem('poker_host', '1');
  showView('game-view', 'home-view');
  renderGame(); startPolling();
  showToast('Share code: ' + gameCode);
}

// ====== JOIN ======
async function joinGame() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('game-code-input').value.trim().toUpperCase();
  if (!name) { showToast('Enter your name!'); return; }
  if (!code) { showToast('Enter a code!'); return; }
  showToast('Joining...');
  const d = await apiPost('join-game', { code, name });
  if (!d) return;
  gameCode = code; myName = name; gameData = d.game; isHost = false;
  localStorage.setItem('poker_name', myName);
  localStorage.setItem('poker_code', gameCode);
  localStorage.removeItem('poker_host');
  showView('game-view', 'home-view');
  renderGame(); startPolling();
  showToast('Joined!');
}

// ====== SEND ACTION ======
async function sendAction(action, extra = {}) {
  const d = await apiPost('action', { code: gameCode, action, playerName: myName, ...extra });
  if (d && d.game) { gameData = d.game; renderGame(); }
  return d;
}

// ====== RENDER ======
function renderGame() {
  if (!gameData) return;

  // Check if I'm host
  if (gameData.hostName && gameData.hostName.toLowerCase() === myName.toLowerCase()) isHost = true;

  document.getElementById('game-code-display').textContent = gameCode;
  document.getElementById('game-hand-display').textContent = 'Hand ' + gameData.handNum;
  document.getElementById('pot-display').textContent = gameData.pot.toLocaleString();

  // Call amount
  const callEl = document.getElementById('call-amount-display');
  if (callEl) callEl.textContent = (gameData.callAmount || 0).toLocaleString();

  renderRoundPills();
  renderPlayers();
  renderLog();

  // Host controls visibility
  const hostCtrls = document.getElementById('host-controls');
  if (hostCtrls) hostCtrls.style.display = isHost ? '' : 'none';

  // Showdown
  const showdownEl = document.getElementById('showdown-bar');
  if (showdownEl) showdownEl.style.display = gameData.roundIdx === 4 ? '' : 'none';

  // My action bar
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  const actionBar = document.getElementById('my-action-bar');
  if (me && !me.folded) {
    actionBar.style.display = '';
    // Update call button text
    const myCallAmt = (gameData.callAmount || 0) - me.bet;
    const callBtn = document.getElementById('btn-call');
    const checkBtn = document.getElementById('btn-check');
    if (myCallAmt > 0) {
      callBtn.style.display = '';
      callBtn.textContent = `Call ${myCallAmt}`;
      checkBtn.style.display = 'none';
    } else {
      callBtn.style.display = 'none';
      checkBtn.style.display = '';
    }
  } else {
    actionBar.style.display = 'none';
  }
}

function renderRoundPills() {
  const c = document.getElementById('round-pills');
  c.innerHTML = '';
  ROUNDS.forEach((name, i) => {
    const pill = document.createElement('span');
    pill.className = 'round-pill' + (i === gameData.roundIdx ? ' active' : '') + (i < gameData.roundIdx ? ' done' : '');
    pill.textContent = name;
    c.appendChild(pill);
  });
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

    // Debts
    let debtsHtml = '';
    if (p.debts && p.debts.length > 0) {
      debtsHtml = '<div class="debt-section">';
      p.debts.forEach(d => {
        const canCollect = d.from.toLowerCase() === myName.toLowerCase() && p.chips >= d.amount;
        debtsHtml += `<div class="debt-badge">
          <span class="debt-text">owes ${d.from}: ${d.amount}</span>
          ${canCollect ? `<button class="debt-collect-btn" onclick="doCollectDebt('${p.name}')">Collect</button>` : ''}
        </div>`;
      });
      debtsHtml += '</div>';
    }

    // Loan button
    let loanBtn = '';
    if (!isMe && p.chips < (gameData.startingBid || 50)) {
      loanBtn = `<button class="player-loan-btn" onclick="openLoanModal('${p.name}')">💰 Loan</button>`;
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
      ${loanBtn}
    `;
    grid.appendChild(card);
  });
}

function renderLog() {
  const el = document.getElementById('activity-log');
  if (!el || !gameData) return;
  el.innerHTML = '';
  if (!gameData.history || !gameData.history.length) {
    el.innerHTML = '<div class="log-entry"><span class="l-text" style="color:var(--muted)">No actions yet</span></div>';
    return;
  }
  gameData.history.slice(0, 20).forEach(e => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="l-time">${e.time}</span><span class="l-text">${e.text}</span>${e.amount != null ? `<span class="l-amt">${Number(e.amount).toLocaleString()}</span>` : ''}`;
    el.appendChild(div);
  });
}

function showTableMessage(msg) {
  const el = document.getElementById('table-message');
  if (!msg) { el.classList.remove('visible'); return; }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), 6000);
}

// ====== MY ACTIONS (free turn — I act for myself only) ======
async function doFold() {
  if (!confirm('Fold?')) return;
  const d = await sendAction('fold');
  if (d) {
    const active = d.game.players.filter(x => !x.folded);
    if (active.length === 1) { showToast(`${active[0].name} wins! 🏆`); launchConfetti(); }
    else showToast('You folded');
  }
}

async function doCall() {
  const d = await sendAction('call');
  if (d) { bumpPot(); showToast('Done!'); }
}

function openRaisePanel() {
  raiseAmount = 0;
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  document.getElementById('raise-max-info').textContent = me ? `Max: ${me.chips.toLocaleString()}` : '';
  document.getElementById('raise-amount-display').textContent = '0';
  document.getElementById('raise-manual-input').value = '';
  document.getElementById('raise-panel').classList.add('visible');
}

function closeRaise() { document.getElementById('raise-panel').classList.remove('visible'); }

function adjustRaise(delta) {
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  if (!me) return;
  raiseAmount = Math.max(0, Math.min(raiseAmount + delta, me.chips));
  document.getElementById('raise-amount-display').textContent = raiseAmount.toLocaleString();
  document.getElementById('raise-manual-input').value = raiseAmount;
}

function setRaiseManual() {
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  if (!me) return;
  const v = parseInt(document.getElementById('raise-manual-input').value) || 0;
  raiseAmount = Math.max(0, Math.min(v, me.chips));
  document.getElementById('raise-amount-display').textContent = raiseAmount.toLocaleString();
}

function raiseAllIn() {
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  if (!me) return;
  raiseAmount = me.chips;
  document.getElementById('raise-amount-display').textContent = raiseAmount.toLocaleString();
  document.getElementById('raise-manual-input').value = raiseAmount;
}

async function confirmRaise() {
  if (raiseAmount <= 0) { showToast('Enter an amount'); return; }
  const d = await sendAction('raise', { amount: raiseAmount });
  if (d) { bumpPot(); showToast(`Raised ${raiseAmount}`); closeRaise(); }
}

function bumpPot() {
  const el = document.getElementById('pot-display');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

// ====== HOST: TAKE FROM POT ======
function openTakeModal() {
  if (!gameData || gameData.pot <= 0) { showToast('Pot is empty'); return; }
  document.getElementById('take-pot-max').textContent = gameData.pot.toLocaleString();
  // Populate player select
  const sel = document.getElementById('take-player-select');
  sel.innerHTML = '';
  gameData.players.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  document.getElementById('take-amount-input').value = '';
  document.getElementById('take-modal').classList.add('open');
}

function closeTakeModal() { document.getElementById('take-modal').classList.remove('open'); }

async function confirmTakeFromPot() {
  const name = document.getElementById('take-player-select').value;
  const amt = parseInt(document.getElementById('take-amount-input').value);
  if (!name || !amt || amt <= 0) { showToast('Enter valid details'); return; }
  const d = await sendAction('take-from-pot', { targetName: name, amount: amt });
  if (d) { showToast(`${amt} returned to ${name}`); closeTakeModal(); }
}

// ====== HOST: RESET CALL ======
async function resetCallAmount() {
  const val = prompt('Set call amount to:', gameData.callAmount || 0);
  if (val === null) return;
  const d = await sendAction('reset-call', { amount: parseInt(val) || 0 });
  if (d) showToast('Call reset!');
}

// ====== HOST: ADVANCE ROUND ======
async function advanceRound() {
  const d = await sendAction('advance-round');
  if (d && d.game) {
    if (d.game.roundMessage) { showTableMessage(d.game.roundMessage); showToast(d.game.roundMessage); }
  }
}

// ====== HOST: NEW HAND ======
async function newHand() {
  if (gameData && gameData.pot > 0 && !confirm('Chips still in pot! New hand?')) return;
  const d = await sendAction('new-hand');
  if (d) showToast(`Hand ${d.game.handNum}`);
}

// ====== AWARD POT ======
function openAwardModal() {
  if (!gameData || gameData.pot <= 0) { showToast('Pot is empty'); return; }
  document.getElementById('award-modal').classList.add('open');
  const opts = document.getElementById('winner-options');
  opts.innerHTML = '';
  document.getElementById('pot-award-display').textContent = gameData.pot.toLocaleString() + ' chips';
  gameData.players.filter(p => !p.folded).forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.style.marginBottom = '8px';
    btn.textContent = p.name;
    btn.onclick = async () => {
      const d = await sendAction('award-pot', { targetName: p.name });
      if (d) { showToast(`${p.name} wins! 🏆`); launchConfetti(); closeAwardModal(); }
    };
    opts.appendChild(btn);
  });
}
function closeAwardModal() { document.getElementById('award-modal').classList.remove('open'); }

// ====== LOAN / DEBT ======
let loanTargetName = '';

function openLoanModal(name) {
  loanTargetName = name;
  document.getElementById('loan-target-name').textContent = name;
  document.getElementById('loan-amount').value = '';
  document.getElementById('loan-modal').classList.add('open');
}
function closeLoanModal() { document.getElementById('loan-modal').classList.remove('open'); }

async function confirmLoan() {
  const amt = parseInt(document.getElementById('loan-amount').value);
  if (!amt || amt <= 0) { showToast('Enter amount'); return; }
  const d = await sendAction('loan', { targetName: loanTargetName, amount: amt });
  if (d) { showToast('Loaned!'); closeLoanModal(); }
}

async function doCollectDebt(borrowerName) {
  const d = await sendAction('collect-debt', { targetName: borrowerName });
  if (d) showToast('Collected!');
}

// ====== LEAVE / SHARE ======
function leaveGame() {
  if (!confirm('Leave?')) return;
  stopPolling(); gameCode = ''; gameData = null;
  localStorage.removeItem('poker_code');
  showView('home-view', 'game-view');
}

function copyCode() {
  const text = `Join my poker game! Code: ${gameCode}\n${window.location.origin}`;
  if (navigator.share) navigator.share({ title: 'PokerChips.io', text }).catch(() => fallbackCopy());
  else fallbackCopy();
}
function fallbackCopy() { navigator.clipboard.writeText(gameCode).catch(() => {}); showToast('Copied: ' + gameCode); }

// ====== CONFETTI ======
function launchConfetti() {
  const colors = ['#c9a84c', '#e8c96b', '#c0392b', '#2563b8', '#1a6b3a'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random()*100+'vw'; p.style.top = '-10px';
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDuration = (1.2+Math.random())+'s';
    p.style.animationDelay = (Math.random()*0.5)+'s';
    const sz = 5+Math.random()*5; p.style.width=sz+'px'; p.style.height=sz+'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2500);
  }
}

// ====== TOAST ======
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => {
  spawnSuitParticles();
  document.getElementById('home-view').classList.add('visible');

  const cs = document.getElementById('start-chips');
  if (cs) { cs.addEventListener('change', updateBidDisplay); updateBidDisplay(); }

  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      closeRaise();
    }
  });

  // Pre-fill
  const saved = localStorage.getItem('poker_name');
  const code = localStorage.getItem('poker_code');
  if (saved) document.getElementById('join-name').value = saved;
  if (code) document.getElementById('game-code-input').value = code;
  if (localStorage.getItem('poker_host') === '1') isHost = true;
});
