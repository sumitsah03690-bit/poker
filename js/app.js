// ============================================================
//  PokerChips.io — Game Logic
// ============================================================

// ====== STATE ======
const gameState = {
  code: '',
  pot: 0,
  bigBlind: 40,
  players: [],
  currentPlayerIdx: 0,
  dealerIdx: 0,
  round: 'Pre-flop',
  handNum: 1,
  currentBet: 0,
  myIdx: 0,
  startingChips: 2000,
  history: []
};

const ROUNDS = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];

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
  const container = document.body;
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('span');
    el.className = 'suit-particle';
    el.textContent = suits[Math.floor(Math.random() * suits.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (15 + Math.random() * 20) + 's';
    el.style.animationDelay = (Math.random() * 15) + 's';
    el.style.fontSize = (0.8 + Math.random() * 1.2) + 'rem';
    container.appendChild(el);
  }
}

// ====== TAB LOGIC ======
function switchTab(tab, e) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`#tab-${tab}`).classList.add('active');
  if (e && e.target) e.target.classList.add('active');
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

// ====== CREATE GAME ======
function createGame() {
  const name = document.getElementById('host-name').value.trim();
  if (!name) { showToast('Enter your name first!'); return; }
  const chips = parseInt(document.getElementById('start-chips').value);
  const bb = parseInt(document.getElementById('big-blind').value);

  gameState.code = randomCode();
  gameState.bigBlind = bb;
  gameState.startingChips = chips;
  gameState.players = [
    { name, chips, bet: 0, folded: false, isMe: true },
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
  showToast('Game not found — try the demo!');
}

function joinDemo() {
  const name = document.getElementById('join-name').value.trim() || 'Guest';
  gameState.code = 'DEMO1';
  gameState.bigBlind = 40;
  gameState.startingChips = 2000;
  gameState.pot = 0;
  gameState.currentBet = 0;
  gameState.handNum = 1;
  gameState.round = 'Pre-flop';
  gameState.history = [];

  const demoPlayers = [
    { name: 'Alice',  chips: 2000, bet: 0, folded: false, isMe: false },
    { name: 'Bob',    chips: 2000, bet: 0, folded: false, isMe: false },
    { name: name,     chips: 2000, bet: 0, folded: false, isMe: true  },
    { name: 'Diana',  chips: 2000, bet: 0, folded: false, isMe: false },
  ];

  gameState.players = demoPlayers;
  gameState.myIdx = 2;
  gameState.dealerIdx = 0;

  // Post blinds (SB = player after dealer, BB = player after SB)
  postBlinds();

  gameState.currentPlayerIdx = gameState.myIdx; // UTG = after BB

  showView('game-view', 'home-view');
  renderGame();
  addHistory('Demo game started');
  showToast('Demo game started! It\'s your turn.');
}

function postBlinds() {
  const numPlayers = gameState.players.length;
  if (numPlayers < 2) return;

  const sbIdx = (gameState.dealerIdx + 1) % numPlayers;
  const bbIdx = (gameState.dealerIdx + 2) % numPlayers;
  const sb = gameState.bigBlind / 2;
  const bb = gameState.bigBlind;

  const sbPlayer = gameState.players[sbIdx];
  const bbPlayer = gameState.players[bbIdx];

  const actualSb = Math.min(sb, sbPlayer.chips);
  sbPlayer.chips -= actualSb;
  sbPlayer.bet = actualSb;

  const actualBb = Math.min(bb, bbPlayer.chips);
  bbPlayer.chips -= actualBb;
  bbPlayer.bet = actualBb;

  gameState.pot = actualSb + actualBb;
  gameState.currentBet = actualBb;

  addHistory(`${sbPlayer.name} posts SB`, actualSb);
  addHistory(`${bbPlayer.name} posts BB`, actualBb);
}

// ====== GAME VIEW ======
function renderGame() {
  document.getElementById('game-code-display').textContent = 'CODE: ' + gameState.code;
  document.getElementById('game-title-display').textContent = 'The Table';
  document.getElementById('game-round-display').textContent = 'Hand ' + gameState.handNum + ' · ' + gameState.round;
  document.getElementById('sb-display').textContent = gameState.bigBlind / 2;
  document.getElementById('bb-display').textContent = gameState.bigBlind;
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
    const card = document.createElement('div');
    card.className = 'player-card' + (isActive ? ' active-player' : '') + (p.folded ? ' folded' : '');
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${p.name}, ${p.chips} chips${isActive ? ', current turn' : ''}${p.folded ? ', folded' : ''}`);

    const initial = p.name.charAt(0).toUpperCase();
    card.innerHTML = `
      <div class="player-avatar">
        ${initial}
        ${isDealer ? '<span class="dealer-chip">D</span>' : ''}
      </div>
      <div class="player-name">${p.name}${p.isMe ? ' <span class="player-you-tag">(you)</span>' : ''}</div>
      <div class="player-chips-label">chips</div>
      <div class="player-chips">${p.chips.toLocaleString()}</div>
      ${p.bet > 0 ? `<div class="player-bet-badge">bet: ${p.bet.toLocaleString()}</div>` : ''}
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
    document.getElementById('btn-call').textContent = `↑ Call ${callAmt}`;
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
  document.getElementById('history-panel').classList.toggle('open');
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
    // All-in protection
    amt = Math.min(amt, me.chips);
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
  void el.offsetWidth; // trigger reflow
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

  // Advance round after full orbit (simplified: when it comes back to the first non-folded player after dealer)
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

// ====== ADD PLAYER (MODAL) ======
function openAddPlayerModal() {
  document.getElementById('add-player-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-player-name').focus(), 100);
}

function closeAddPlayerModal() {
  document.getElementById('add-player-modal').classList.remove('open');
  document.getElementById('new-player-name').value = '';
  document.getElementById('new-player-chips').value = gameState.startingChips;
}

function confirmAddPlayer() {
  const name = document.getElementById('new-player-name').value.trim();
  const chips = parseInt(document.getElementById('new-player-chips').value) || gameState.startingChips;
  if (!name) { showToast('Enter a player name!'); return; }

  gameState.players.push({ name, chips, bet: 0, folded: false, isMe: false });
  addHistory(`${name} joined the table`);
  renderGame();
  showToast(`${name} joined the table!`);
  closeAddPlayerModal();
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
    postBlinds();
    // Set current player to UTG (after BB)
    const utg = (gameState.dealerIdx + 3) % gameState.players.length;
    gameState.currentPlayerIdx = utg;
  }

  addHistory(`Hand ${gameState.handNum} begins`);
  renderGame();
  showToast(`Hand ${gameState.handNum} — blinds posted`);
}

// ====== LEAVE GAME ======
function leaveGame() {
  if (!confirm('Leave the game?')) return;
  showView('home-view', 'game-view');
}

// ====== COPY CODE ======
function copyCode() {
  navigator.clipboard.writeText(gameState.code).catch(() => {});
  showToast('Code copied: ' + gameState.code);
}

// ====== CONFETTI ======
function launchConfetti() {
  const colors = ['#c9a84c', '#e8c96b', '#c0392b', '#2563b8', '#1a6b3a', '#f2ede0'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.top = '-10px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.2 + Math.random() * 1) + 's';
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    piece.style.width = (6 + Math.random() * 6) + 'px';
    piece.style.height = (6 + Math.random() * 6) + 'px';
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

  // Set default chips for add-player modal
  const chipInput = document.getElementById('new-player-chips');
  if (chipInput) chipInput.value = 2000;

  // Handle Enter key on add player modal
  const nameInput = document.getElementById('new-player-name');
  if (nameInput) {
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmAddPlayer();
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
});
