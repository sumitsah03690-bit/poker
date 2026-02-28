// ============================================================
//  PokerChips.io — Personal Edition
//  Game Logic with Debt System
// ============================================================

// ====== STATE ======
const gameState = {
  code: '',
  pot: 0,
  startingBid: 50,
  players: [],
  currentPlayerIdx: 0,
  dealerIdx: 0,
  round: 'Pre-flop',
  handNum: 1,
  currentBet: 0,
  myIdx: 0,
  startingChips: 2000,
  history: [],
  isHost: false
};

const ROUNDS = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];

// Chip-to-bid mapping: chips / 40
function calcStartingBid(chips) {
  return Math.round(chips / 40);
}

// ====== UTILITIES ======
function randomCode() {
  const chars = 'ACEKQJ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function timestamp() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addHistory(action, amount) {
  gameState.history.unshift({
    time: timestamp(),
    action,
    amount: amount || null
  });
  if (gameState.history.length > 50) gameState.history.pop();
  renderHistory();
}

// ====== FLOATING SUIT PARTICLES ======
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

// ====== TAB LOGIC ======
function switchTab(tab, e) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`#tab-${tab}`).classList.add('active');
  if (e && e.target) {
    e.target.classList.add('active');
    e.target.setAttribute('aria-selected', 'true');
  }
}

// ====== VIEW TRANSITIONS ======
function showView(showId, hideId) {
  const showEl = document.getElementById(showId);
  const hideEl = document.getElementById(hideId);

  hideEl.classList.remove('visible');
  hideEl.classList.add('hidden');

  setTimeout(() => {
    showEl.classList.remove('hidden');
    showEl.classList.add('visible');
  }, 150);
}

// ====== STARTING BID DISPLAY ======
function updateBidDisplay() {
  const chips = parseInt(document.getElementById('start-chips').value);
  const bid = calcStartingBid(chips);
  const display = document.getElementById('bid-display-value');
  if (display) display.textContent = bid;
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
  gameState.players = [
    { name, chips, bet: 0, folded: false, isMe: true, debts: [] },
  ];
  gameState.myIdx = 0;
  gameState.dealerIdx = 0;
  gameState.currentPlayerIdx = 0;
  gameState.pot = 0;
  gameState.currentBet = 0;
  gameState.handNum = 1;
  gameState.round = 'Pre-flop';
  gameState.history = [];

  addHistory(`${name} created the game`);

  showView('game-view', 'home-view');
  renderGame();
  showToast('Game created! Share code: ' + gameState.code);
}

// ====== JOIN GAME ======
function joinGame() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('game-code-input').value.trim().toUpperCase();
  if (!name) { showToast('Enter your name!'); return; }
  if (!code) { showToast('Enter a game code!'); return; }

  // In a local-only app, simulate joining by adding to the game state
  // In production this would be a server call
  if (gameState.code && gameState.code === code) {
    // Check if name already exists
    const exists = gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) { showToast('That name is taken!'); return; }

    gameState.players.push({
      name,
      chips: gameState.startingChips,
      bet: 0,
      folded: false,
      isMe: false,
      debts: []
    });
    addHistory(`${name} joined the table`);
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
  gameState.isHost = false;
  gameState.pot = 0;
  gameState.currentBet = 0;
  gameState.handNum = 1;
  gameState.round = 'Pre-flop';
  gameState.history = [];

  gameState.players = [
    { name: 'Alice',  chips: 2000, bet: 0, folded: false, isMe: false, debts: [] },
    { name: 'Bob',    chips: 2000, bet: 0, folded: false, isMe: false, debts: [] },
    { name: name,     chips: 2000, bet: 0, folded: false, isMe: true,  debts: [] },
    { name: 'Diana',  chips: 2000, bet: 0, folded: false, isMe: false, debts: [] },
  ];

  gameState.myIdx = 2;
  gameState.dealerIdx = 0;

  // Post starting bid
  postStartingBid();

  // UTG (after the bid poster)
  const bidPosterIdx = (gameState.dealerIdx + 1) % gameState.players.length;
  gameState.currentPlayerIdx = (bidPosterIdx + 1) % gameState.players.length;

  showView('game-view', 'home-view');
  renderGame();
  addHistory('Demo game started');
  showToast('Demo game started!');
}

function postStartingBid() {
  const numPlayers = gameState.players.length;
  if (numPlayers < 2) return;

  // Only the player left of dealer posts the starting bid
  const bidderIdx = (gameState.dealerIdx + 1) % numPlayers;
  const bidder = gameState.players[bidderIdx];
  const bid = Math.min(gameState.startingBid, bidder.chips);

  bidder.chips -= bid;
  bidder.bet = bid;
  gameState.pot = bid;
  gameState.currentBet = bid;

  addHistory(`${bidder.name} posts bid`, bid);
}

// ====== GAME RENDERING ======
function renderGame() {
  document.getElementById('game-code-display').textContent = gameState.code;
  document.getElementById('game-title-display').textContent = 'The Table';
  document.getElementById('game-round-display').textContent = 'Hand ' + gameState.handNum + ' · ' + gameState.round;
  document.getElementById('bid-value-display').textContent = gameState.startingBid;
  document.getElementById('hand-num-display').textContent = gameState.handNum;

  const potEl = document.getElementById('pot-display');
  potEl.textContent = gameState.pot.toLocaleString();

  renderPlayers();
  renderActions();
  renderHistory();
}

function renderPlayers() {
  const grid = document.getElementById('players-grid');
  grid.innerHTML = '';

  gameState.players.forEach((p, i) => {
    const isActive = i === gameState.currentPlayerIdx;
    const isDealer = i === gameState.dealerIdx;
    const isMe = p.isMe;
    const card = document.createElement('div');
    card.className = 'player-card' + (isActive ? ' active-player' : '') + (p.folded ? ' folded' : '');
    card.setAttribute('role', 'listitem');

    const initial = p.name.charAt(0).toUpperCase();

    // Build debts HTML
    let debtsHtml = '';
    if (p.debts && p.debts.length > 0) {
      debtsHtml = '<div class="debt-section">';
      p.debts.forEach((d, di) => {
        const lender = gameState.players.find(pl => pl.name === d.from);
        const canCollect = lender && lender.isMe && p.chips >= d.amount;
        debtsHtml += `
          <div class="debt-badge">
            <span class="debt-text">owes ${d.from}: ${d.amount}</span>
            ${canCollect ? `<button class="debt-collect-btn" onclick="collectDebt(${i}, ${di})">Collect</button>` : ''}
          </div>
        `;
      });
      debtsHtml += '</div>';
    }

    // Show loan button on other players' cards (only if they're low/out)
    let loanBtn = '';
    if (!isMe && p.chips < gameState.startingBid) {
      loanBtn = `<button class="player-loan-btn" onclick="openLoanModal(${i})">💰 Give Loan</button>`;
    }

    card.innerHTML = `
      <div class="player-top">
        <div class="player-avatar">
          ${initial}
          ${isDealer ? '<span class="dealer-chip">D</span>' : ''}
        </div>
        <div>
          <div class="player-name">${p.name}${isMe ? ' <span class="player-you-tag">(you)</span>' : ''}</div>
        </div>
      </div>
      <div class="player-chips-row">
        <span class="player-chips-label">chips</span>
        <span class="player-chips">${p.chips.toLocaleString()}</span>
      </div>
      ${p.bet > 0 ? `<div class="player-bet-badge">bet: ${p.bet.toLocaleString()}</div>` : ''}
      ${debtsHtml}
      ${loanBtn}
    `;
    grid.appendChild(card);
  });
}

function renderActions() {
  const me = gameState.players[gameState.myIdx];
  const isMyTurn = gameState.currentPlayerIdx === gameState.myIdx;
  const label = document.getElementById('turn-label');
  const current = gameState.players[gameState.currentPlayerIdx];

  if (isMyTurn && me && !me.folded) {
    label.textContent = '→ Your turn';
  } else if (me && me.folded) {
    label.textContent = 'You folded this hand';
  } else {
    label.textContent = `Waiting for ${current ? current.name : '...'}...`;
  }

  const showActions = isMyTurn && me && !me.folded;

  document.getElementById('btn-fold').style.display = showActions ? '' : 'none';
  document.getElementById('btn-award').style.display = showActions ? '' : 'none';
  document.getElementById('raise-wrap').style.display = showActions ? '' : 'none';
  document.getElementById('btn-new-hand').style.display = showActions ? '' : 'none';

  const canCheck = me && me.bet >= gameState.currentBet;
  document.getElementById('btn-check').style.display = showActions && canCheck ? '' : 'none';
  document.getElementById('btn-call').style.display = showActions && !canCheck ? '' : 'none';

  if (!canCheck && showActions) {
    const callAmt = gameState.currentBet - (me ? me.bet : 0);
    document.getElementById('btn-call').textContent = `Call ${callAmt}`;
  }
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = '';

  if (gameState.history.length === 0) {
    const li = document.createElement('li');
    li.className = 'history-entry';
    li.innerHTML = '<span class="h-action" style="color:var(--muted)">No actions yet</span>';
    list.appendChild(li);
    return;
  }

  gameState.history.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'history-entry';
    li.innerHTML = `
      <span class="h-time">${entry.time}</span>
      <span class="h-action">${entry.action}</span>
      ${entry.amount !== null ? `<span class="h-amount">${entry.amount.toLocaleString()}</span>` : ''}
    `;
    list.appendChild(li);
  });
}

function toggleHistory() {
  const panel = document.getElementById('history-panel');
  panel.classList.toggle('open');
  const header = panel.querySelector('.history-header');
  header.setAttribute('aria-expanded', panel.classList.contains('open'));
}

// ====== PLAYER ACTIONS ======
function playerAction(action) {
  const me = gameState.players[gameState.myIdx];
  if (!me || me.folded) return;

  if (action === 'fold') {
    if (!confirm('Are you sure you want to fold?')) return;
    me.folded = true;
    addHistory(`${me.name} folds`);
    showToast('You folded.');
    advanceTurn();
  } else if (action === 'check') {
    addHistory(`${me.name} checks`);
    showToast('Check.');
    advanceTurn();
  } else if (action === 'call') {
    const callAmt = gameState.currentBet - me.bet;
    const actual = Math.min(callAmt, me.chips);
    me.chips -= actual;
    me.bet += actual;
    gameState.pot += actual;
    addHistory(`${me.name} calls`, actual);
    showToast(`Called ${actual}.`);
    bumpPot();
    advanceTurn();
  } else if (action === 'raise') {
    const input = document.getElementById('raise-amount');
    let amt = parseInt(input.value);
    if (!amt || amt <= 0) { showToast('Enter a valid raise amount'); return; }
    amt = Math.min(amt, me.chips); // all-in protection
    me.chips -= amt;
    me.bet += amt;
    gameState.pot += amt;
    gameState.currentBet = me.bet;
    input.value = '';
    addHistory(`${me.name} raises`, amt);
    showToast(me.chips === 0 ? `ALL IN — ${me.bet}!` : `Raised to ${me.bet}.`);
    bumpPot();
    advanceTurn();
  }

  renderGame();
}

function bumpPot() {
  const el = document.getElementById('pot-display');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function advanceTurn() {
  const n = gameState.players.length;
  let next = (gameState.currentPlayerIdx + 1) % n;
  let tries = 0;
  while (gameState.players[next].folded && tries < n) {
    next = (next + 1) % n;
    tries++;
  }
  gameState.currentPlayerIdx = next;

  // Check if only one player remains
  const activePlayers = gameState.players.filter(p => !p.folded);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winner.chips += gameState.pot;
    addHistory(`${winner.name} wins (last standing)`, gameState.pot);
    showToast(`${winner.name} wins ${gameState.pot} chips! 🏆`);
    launchConfetti();
    gameState.pot = 0;
    gameState.handNum++;
    gameState.round = 'Pre-flop';
    gameState.currentBet = 0;
    gameState.players.forEach(p => { p.bet = 0; p.folded = false; });
    advanceDealer();
    renderGame();
    return;
  }

  // Advance round
  const ri = ROUNDS.indexOf(gameState.round);
  if (next === gameState.myIdx && ri < ROUNDS.length - 1) {
    gameState.round = ROUNDS[ri + 1];
    gameState.players.forEach(p => p.bet = 0);
    gameState.currentBet = 0;
    addHistory(`Street: ${gameState.round}`);
    showToast('New street: ' + gameState.round);
  }
}

function advanceDealer() {
  gameState.dealerIdx = (gameState.dealerIdx + 1) % gameState.players.length;
}

// ====== NEW HAND ======
function newHand() {
  if (gameState.pot > 0) {
    if (!confirm('There are still chips in the pot! Start new hand anyway?')) return;
  }
  gameState.handNum++;
  gameState.round = 'Pre-flop';
  gameState.currentBet = 0;
  gameState.pot = 0;
  gameState.players.forEach(p => { p.bet = 0; p.folded = false; });
  advanceDealer();

  if (gameState.players.length >= 2) {
    postStartingBid();
    const bidPosterIdx = (gameState.dealerIdx + 1) % gameState.players.length;
    gameState.currentPlayerIdx = (bidPosterIdx + 1) % gameState.players.length;
  }

  addHistory(`Hand ${gameState.handNum} begins`);
  renderGame();
  showToast(`Hand ${gameState.handNum} — bid posted`);
}

// ====== DEBT / LOAN SYSTEM ======
let loanTargetIdx = -1;

function openLoanModal(playerIdx) {
  loanTargetIdx = playerIdx;
  const player = gameState.players[playerIdx];
  document.getElementById('loan-target-name').textContent = player.name;
  document.getElementById('loan-amount').value = '';
  document.getElementById('loan-modal').classList.add('open');
  setTimeout(() => document.getElementById('loan-amount').focus(), 100);
}

function closeLoanModal() {
  document.getElementById('loan-modal').classList.remove('open');
  loanTargetIdx = -1;
}

function confirmLoan() {
  if (loanTargetIdx < 0) return;
  const me = gameState.players[gameState.myIdx];
  const borrower = gameState.players[loanTargetIdx];
  const amt = parseInt(document.getElementById('loan-amount').value);

  if (!amt || amt <= 0) { showToast('Enter a valid amount'); return; }
  if (amt > me.chips) { showToast('You don\'t have enough chips!'); return; }

  // Transfer chips
  me.chips -= amt;
  borrower.chips += amt;

  // Record debt on the borrower
  const existing = borrower.debts.find(d => d.from === me.name);
  if (existing) {
    existing.amount += amt;
  } else {
    borrower.debts.push({ from: me.name, amount: amt });
  }

  addHistory(`${me.name} loaned ${amt} to ${borrower.name}`, amt);
  showToast(`Loaned ${amt} chips to ${borrower.name}`);
  closeLoanModal();
  renderGame();
}

function collectDebt(borrowerIdx, debtIdx) {
  const borrower = gameState.players[borrowerIdx];
  const debt = borrower.debts[debtIdx];
  if (!debt) return;

  const me = gameState.players[gameState.myIdx];
  if (debt.from !== me.name) { showToast('This isn\'t your debt to collect!'); return; }

  if (borrower.chips < debt.amount) {
    showToast(`${borrower.name} doesn't have enough chips (has ${borrower.chips}, owes ${debt.amount})`);
    return;
  }

  // Transfer back
  borrower.chips -= debt.amount;
  me.chips += debt.amount;

  addHistory(`${me.name} collected debt from ${borrower.name}`, debt.amount);
  showToast(`Collected ${debt.amount} chips from ${borrower.name}`);

  // Remove debt record
  borrower.debts.splice(debtIdx, 1);
  renderGame();
}

// ====== AWARD POT ======
function openAwardModal() {
  const modal = document.getElementById('award-modal');
  modal.classList.add('open');
  const opts = document.getElementById('winner-options');
  opts.innerHTML = '';
  document.getElementById('pot-award-display').textContent = gameState.pot.toLocaleString() + ' chips';

  gameState.players.forEach((p, i) => {
    if (!p.folded) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline';
      btn.style.cssText = 'margin-bottom:10px;';
      btn.textContent = p.name + ' wins!';
      btn.onclick = () => awardPot(i);
      opts.appendChild(btn);
    }
  });
}

function awardPot(winnerIdx) {
  const winner = gameState.players[winnerIdx];
  const wonAmount = gameState.pot;
  winner.chips += wonAmount;
  addHistory(`${winner.name} wins the pot`, wonAmount);
  showToast(`${winner.name} wins ${wonAmount.toLocaleString()} chips! 🏆`);
  launchConfetti();
  gameState.pot = 0;
  gameState.handNum++;
  gameState.round = 'Pre-flop';
  gameState.currentBet = 0;
  gameState.players.forEach(p => { p.bet = 0; p.folded = false; });
  advanceDealer();
  closeAwardModal();
  renderGame();
}

function closeAwardModal() {
  document.getElementById('award-modal').classList.remove('open');
}

// ====== LEAVE GAME ======
function leaveGame() {
  if (!confirm('Leave the game?')) return;
  showView('home-view', 'game-view');
}

// ====== COPY CODE / SHARE ======
function copyCode() {
  const shareText = `Join my poker game! Code: ${gameState.code}\n${window.location.href}`;
  if (navigator.share) {
    navigator.share({
      title: 'PokerChips.io Game',
      text: `Join my poker game! Code: ${gameState.code}`,
      url: window.location.href
    }).catch(() => {
      fallbackCopy(shareText);
    });
  } else {
    fallbackCopy(gameState.code);
  }
}

function fallbackCopy(text) {
  navigator.clipboard.writeText(text).catch(() => {});
  showToast('Code copied: ' + gameState.code);
}

// ====== CONFETTI ======
function launchConfetti() {
  const colors = ['#c9a84c', '#e8c96b', '#c0392b', '#2563b8', '#1a6b3a', '#f2ede0'];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.top = '-10px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.2 + Math.random() * 1) + 's';
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    piece.style.width = (5 + Math.random() * 5) + 'px';
    piece.style.height = (5 + Math.random() * 5) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2500);
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

  // Make home view visible
  document.getElementById('home-view').classList.add('visible');

  // Update bid display when chips change
  const chipsSelect = document.getElementById('start-chips');
  if (chipsSelect) {
    chipsSelect.addEventListener('change', updateBidDisplay);
    updateBidDisplay();
  }

  // Handle Enter key on loan modal
  const loanInput = document.getElementById('loan-amount');
  if (loanInput) {
    loanInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmLoan();
    });
  }

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Close modals on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Prevent viewport zoom on double-tap (mobile)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, false);
});
