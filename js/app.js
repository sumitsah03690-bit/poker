// ============================================================
//  PokerChips.io — Personal Edition v3
//  Free Turn, Casual Poker with Debt System
// ============================================================

// ====== STATE ======
const gameState = {
  code: '',
  pot: 0,
  startingBid: 50,
  players: [],
  dealerIdx: 0,
  roundIdx: 0,
  handNum: 1,
  myIdx: 0,
  startingChips: 2000,
  history: [],
  isHost: false,
  raisePlayerIdx: -1,
  raiseAmount: 0
};

const ROUNDS = [
  { name: 'Pre-flop', msg: '' },
  { name: 'Flop',     msg: '🃏 Deal 3 community cards face up' },
  { name: 'Turn',     msg: '🃏 Deal the 4th community card' },
  { name: 'River',    msg: '🃏 Deal the 5th and final card' },
  { name: 'Showdown', msg: '🏆 Reveal hands — award the pot!' }
];

function calcStartingBid(chips) { return Math.round(chips / 40); }

// ====== UTILITIES ======
function randomCode() {
  const chars = 'ACEKQJ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function log(text, amount) {
  gameState.history.unshift({ time: ts(), text, amount: amount || null });
  if (gameState.history.length > 60) gameState.history.pop();
  renderLog();
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
function createGame() {
  const name = document.getElementById('host-name').value.trim();
  if (!name) { showToast('Enter your name first!'); return; }
  const chips = parseInt(document.getElementById('start-chips').value);

  gameState.code = randomCode();
  gameState.startingChips = chips;
  gameState.startingBid = calcStartingBid(chips);
  gameState.isHost = true;
  gameState.players = [{ name, chips, bet: 0, folded: false, isMe: true, debts: [] }];
  gameState.myIdx = 0;
  gameState.dealerIdx = 0;
  gameState.pot = 0;
  gameState.handNum = 1;
  gameState.roundIdx = 0;
  gameState.history = [];

  log(`${name} created the game`);
  showView('game-view', 'home-view');
  renderGame();
  showToast('Game created! Share code: ' + gameState.code);
}

// ====== JOIN ======
function joinGame() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('game-code-input').value.trim().toUpperCase();
  if (!name) { showToast('Enter your name!'); return; }
  if (!code) { showToast('Enter a game code!'); return; }

  if (gameState.code && gameState.code === code) {
    if (gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase())) { showToast('That name is taken!'); return; }
    gameState.players.push({ name, chips: gameState.startingChips, bet: 0, folded: false, isMe: false, debts: [] });
    log(`${name} joined`);
    renderGame();
    showToast(`${name} joined!`);
  } else {
    showToast('Game not found — try the demo!');
  }
}

function joinDemo() {
  const name = document.getElementById('join-name').value.trim() || 'You';
  gameState.code = 'DEMO1';
  gameState.startingChips = 2000;
  gameState.startingBid = calcStartingBid(2000);
  gameState.isHost = true;
  gameState.pot = 0;
  gameState.handNum = 1;
  gameState.roundIdx = 0;
  gameState.history = [];

  gameState.players = [
    { name: 'Alice',  chips: 2000, bet: 0, folded: false, isMe: false, debts: [] },
    { name: 'Bob',    chips: 2000, bet: 0, folded: false, isMe: false, debts: [] },
    { name: name,     chips: 2000, bet: 0, folded: false, isMe: true,  debts: [] },
    { name: 'Diana',  chips: 2000, bet: 0, folded: false, isMe: false, debts: [] },
  ];
  gameState.myIdx = 2;
  gameState.dealerIdx = 0;

  postStartingBid();

  showView('game-view', 'home-view');
  renderGame();
  log('Demo game started');
  showToast('Demo game started!');
}

function postStartingBid() {
  const n = gameState.players.length;
  if (n < 2) return;
  const idx = (gameState.dealerIdx + 1) % n;
  const p = gameState.players[idx];
  const bid = Math.min(gameState.startingBid, p.chips);
  p.chips -= bid;
  p.bet = bid;
  gameState.pot = bid;
  log(`${p.name} posts bid`, bid);
}

// ====== RENDER ======
function renderGame() {
  document.getElementById('game-code-display').textContent = gameState.code;
  document.getElementById('game-round-display').textContent = 'Hand ' + gameState.handNum;
  document.getElementById('pot-display').textContent = gameState.pot.toLocaleString();

  renderRoundStepper();
  renderPlayers();
  renderLog();
}

function renderRoundStepper() {
  const container = document.getElementById('round-pills');
  container.innerHTML = '';
  ROUNDS.forEach((r, i) => {
    const pill = document.createElement('span');
    pill.className = 'round-pill' + (i === gameState.roundIdx ? ' active' : '') + (i < gameState.roundIdx ? ' done' : '');
    pill.textContent = r.name;
    container.appendChild(pill);
  });

  const btnText = document.getElementById('round-advance-text');
  if (gameState.roundIdx < ROUNDS.length - 1) {
    btnText.textContent = 'Next → ' + ROUNDS[gameState.roundIdx + 1].name;
  } else {
    btnText.textContent = 'End Hand';
  }
}

function advanceRound() {
  if (gameState.roundIdx < ROUNDS.length - 1) {
    gameState.roundIdx++;
    const r = ROUNDS[gameState.roundIdx];

    // Reset bets for new street
    gameState.players.forEach(p => p.bet = 0);

    log(`Street: ${r.name}`);
    showTableMessage(r.msg);
    showToast(r.msg);
  } else {
    // End of hand — showdown complete
    showTableMessage('🏆 Hand over — award the pot!');
  }
  renderGame();
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

  gameState.players.forEach((p, i) => {
    const isDealer = i === gameState.dealerIdx;
    const card = document.createElement('div');
    card.className = 'player-card' + (p.folded ? ' folded' : '');

    const initial = p.name.charAt(0).toUpperCase();

    // Debts HTML
    let debtsHtml = '';
    if (p.debts && p.debts.length > 0) {
      debtsHtml = '<div class="debt-section">';
      p.debts.forEach((d, di) => {
        const isMyDebt = gameState.players[gameState.myIdx] && gameState.players[gameState.myIdx].name === d.from;
        const canCollect = isMyDebt && p.chips >= d.amount;
        debtsHtml += `<div class="debt-badge">
          <span class="debt-text">owes ${d.from}: ${d.amount}</span>
          ${canCollect ? `<button class="debt-collect-btn" onclick="collectDebt(${i},${di})">Collect</button>` : ''}
        </div>`;
      });
      debtsHtml += '</div>';
    }

    // Loan button (show if low chips)
    let loanBtn = '';
    if (!p.isMe && p.chips < gameState.startingBid) {
      loanBtn = `<button class="player-loan-btn" onclick="openLoanModal(${i})">💰 Loan</button>`;
    }

    // Per-player action buttons (free turn — everyone can act)
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
        <div>
          <div class="player-name">${p.name}${p.isMe ? ' <span class="player-you-tag">(you)</span>' : ''}</div>
        </div>
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
  if (!el) return;
  el.innerHTML = '';

  if (gameState.history.length === 0) {
    el.innerHTML = '<div class="log-entry"><span class="l-text" style="color:var(--muted)">No actions yet</span></div>';
    return;
  }

  gameState.history.slice(0, 15).forEach(e => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="l-time">${e.time}</span><span class="l-text">${e.text}</span>${e.amount !== null ? `<span class="l-amt">${e.amount.toLocaleString()}</span>` : ''}`;
    el.appendChild(div);
  });
}

// ====== PLAYER ACTIONS (Free Turn — per player) ======
function doFold(idx) {
  const p = gameState.players[idx];
  if (p.folded) return;
  if (!confirm(`Fold ${p.name}?`)) return;
  p.folded = true;
  log(`${p.name} folds`);
  showToast(`${p.name} folded`);

  // Auto-win if only 1 left
  const active = gameState.players.filter(x => !x.folded);
  if (active.length === 1) {
    const winner = active[0];
    winner.chips += gameState.pot;
    log(`${winner.name} wins (last standing)`, gameState.pot);
    showToast(`${winner.name} wins ${gameState.pot} chips! 🏆`);
    launchConfetti();
    gameState.pot = 0;
    startNewHand();
  }
  renderGame();
}

function doCall(idx) {
  const p = gameState.players[idx];
  if (p.folded) return;

  // If no current bet above theirs, it's a check
  const currentMax = Math.max(...gameState.players.map(x => x.bet));
  if (p.bet >= currentMax) {
    log(`${p.name} checks`);
    showToast(`${p.name} checks`);
  } else {
    const callAmt = currentMax - p.bet;
    const actual = Math.min(callAmt, p.chips);
    p.chips -= actual;
    p.bet += actual;
    gameState.pot += actual;
    log(`${p.name} calls`, actual);
    showToast(`${p.name} calls ${actual}`);
    bumpPot();
  }
  renderGame();
}

// ====== RAISE PANEL ======
function openRaise(idx) {
  const p = gameState.players[idx];
  if (p.folded) return;

  gameState.raisePlayerIdx = idx;
  gameState.raiseAmount = 0;

  document.getElementById('raise-for-name').textContent = p.name;
  document.getElementById('raise-max-info').textContent = `Max: ${p.chips.toLocaleString()}`;
  document.getElementById('raise-amount-display').textContent = '0';
  document.getElementById('raise-manual-input').value = '';

  document.getElementById('raise-panel').classList.add('visible');

  // Scroll to raise panel
  document.getElementById('raise-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeRaise() {
  document.getElementById('raise-panel').classList.remove('visible');
  gameState.raisePlayerIdx = -1;
}

function adjustRaise(delta) {
  const idx = gameState.raisePlayerIdx;
  if (idx < 0) return;
  const p = gameState.players[idx];
  gameState.raiseAmount = Math.max(0, Math.min(gameState.raiseAmount + delta, p.chips));
  document.getElementById('raise-amount-display').textContent = gameState.raiseAmount.toLocaleString();
  document.getElementById('raise-manual-input').value = gameState.raiseAmount;
}

function setRaiseManual() {
  const idx = gameState.raisePlayerIdx;
  if (idx < 0) return;
  const p = gameState.players[idx];
  const val = parseInt(document.getElementById('raise-manual-input').value) || 0;
  gameState.raiseAmount = Math.max(0, Math.min(val, p.chips));
  document.getElementById('raise-amount-display').textContent = gameState.raiseAmount.toLocaleString();
}

function raiseAllIn() {
  const idx = gameState.raisePlayerIdx;
  if (idx < 0) return;
  const p = gameState.players[idx];
  gameState.raiseAmount = p.chips;
  document.getElementById('raise-amount-display').textContent = gameState.raiseAmount.toLocaleString();
  document.getElementById('raise-manual-input').value = gameState.raiseAmount;
}

function confirmRaise() {
  const idx = gameState.raisePlayerIdx;
  if (idx < 0) return;
  const p = gameState.players[idx];
  const amt = gameState.raiseAmount;

  if (amt <= 0) { showToast('Enter an amount to raise'); return; }
  if (amt > p.chips) { showToast('Not enough chips!'); return; }

  p.chips -= amt;
  p.bet += amt;
  gameState.pot += amt;

  log(`${p.name} raises`, amt);
  showToast(p.chips === 0 ? `${p.name} ALL IN!` : `${p.name} raises ${amt}`);
  bumpPot();
  closeRaise();
  renderGame();
}

function bumpPot() {
  const el = document.getElementById('pot-display');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

// ====== TAKE FROM POT ======
function takeFromPot() {
  if (gameState.pot <= 0) { showToast('Pot is empty'); return; }
  const name = prompt('Who gets the chips back?');
  if (!name) return;
  const player = gameState.players.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
  if (!player) { showToast('Player not found!'); return; }

  const amtStr = prompt(`Take how much from pot? (Pot: ${gameState.pot})`);
  const amt = parseInt(amtStr);
  if (!amt || amt <= 0) return;
  const actual = Math.min(amt, gameState.pot);

  gameState.pot -= actual;
  player.chips += actual;
  log(`↩ ${actual} returned to ${player.name}`, actual);
  showToast(`${actual} chips returned to ${player.name}`);
  renderGame();
}

// ====== NEW HAND ======
function newHand() {
  if (gameState.pot > 0) {
    if (!confirm('Chips still in pot! Start new hand?')) return;
  }
  startNewHand();
  renderGame();
  showToast(`Hand ${gameState.handNum} — bid posted`);
}

function startNewHand() {
  gameState.handNum++;
  gameState.roundIdx = 0;
  gameState.pot = 0;
  gameState.players.forEach(p => { p.bet = 0; p.folded = false; });
  gameState.dealerIdx = (gameState.dealerIdx + 1) % gameState.players.length;

  if (gameState.players.length >= 2) {
    postStartingBid();
  }

  log(`Hand ${gameState.handNum} begins`);
  showTableMessage('');
}

// ====== AWARD POT ======
function openAwardModal() {
  if (gameState.pot <= 0) { showToast('Pot is empty'); return; }
  const modal = document.getElementById('award-modal');
  modal.classList.add('open');
  const opts = document.getElementById('winner-options');
  opts.innerHTML = '';
  document.getElementById('pot-award-display').textContent = gameState.pot.toLocaleString() + ' chips';

  gameState.players.forEach((p, i) => {
    if (!p.folded) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline';
      btn.style.marginBottom = '8px';
      btn.textContent = p.name + ' wins!';
      btn.onclick = () => awardPot(i);
      opts.appendChild(btn);
    }
  });
}

function awardPot(winnerIdx) {
  const winner = gameState.players[winnerIdx];
  const won = gameState.pot;
  winner.chips += won;
  log(`${winner.name} wins the pot`, won);
  showToast(`${winner.name} wins ${won.toLocaleString()} chips! 🏆`);
  launchConfetti();
  gameState.pot = 0;
  closeAwardModal();
  startNewHand();
  renderGame();
}

function closeAwardModal() { document.getElementById('award-modal').classList.remove('open'); }

// ====== DEBT / LOAN ======
let loanTargetIdx = -1;

function openLoanModal(idx) {
  loanTargetIdx = idx;
  document.getElementById('loan-target-name').textContent = gameState.players[idx].name;
  document.getElementById('loan-amount').value = '';
  document.getElementById('loan-modal').classList.add('open');
  setTimeout(() => document.getElementById('loan-amount').focus(), 100);
}

function closeLoanModal() { document.getElementById('loan-modal').classList.remove('open'); loanTargetIdx = -1; }

function confirmLoan() {
  if (loanTargetIdx < 0) return;
  const me = gameState.players[gameState.myIdx];
  const borrower = gameState.players[loanTargetIdx];
  const amt = parseInt(document.getElementById('loan-amount').value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount'); return; }
  if (amt > me.chips) { showToast('You don\'t have enough chips!'); return; }

  me.chips -= amt;
  borrower.chips += amt;

  const existing = borrower.debts.find(d => d.from === me.name);
  if (existing) { existing.amount += amt; } else { borrower.debts.push({ from: me.name, amount: amt }); }

  log(`${me.name} loaned to ${borrower.name}`, amt);
  showToast(`Loaned ${amt} to ${borrower.name}`);
  closeLoanModal();
  renderGame();
}

function collectDebt(borrowerIdx, debtIdx) {
  const borrower = gameState.players[borrowerIdx];
  const debt = borrower.debts[debtIdx];
  if (!debt) return;
  const me = gameState.players[gameState.myIdx];
  if (debt.from !== me.name) return;
  if (borrower.chips < debt.amount) { showToast(`${borrower.name} doesn't have enough`); return; }

  borrower.chips -= debt.amount;
  me.chips += debt.amount;
  log(`${me.name} collected debt from ${borrower.name}`, debt.amount);
  showToast(`Collected ${debt.amount} from ${borrower.name}`);
  borrower.debts.splice(debtIdx, 1);
  renderGame();
}

// ====== LEAVE ======
function leaveGame() {
  if (!confirm('Leave the game?')) return;
  showView('home-view', 'game-view');
}

// ====== SHARE ======
function copyCode() {
  const text = `Join my poker game! Code: ${gameState.code}`;
  if (navigator.share) {
    navigator.share({ title: 'PokerChips.io', text, url: window.location.href }).catch(() => fallbackCopy());
  } else { fallbackCopy(); }
}
function fallbackCopy() {
  navigator.clipboard.writeText(gameState.code).catch(() => {});
  showToast('Code copied: ' + gameState.code);
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

  // Prevent double-tap zoom on mobile
  let lastTouch = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  }, false);
});
