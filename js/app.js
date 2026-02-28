/* ═══════════════════════════════════════════════════════
   PokerChips.io — Client v4 (Clean Rebuild)
   Free turn · Own-player only · Dark mode
   ═══════════════════════════════════════════════════════ */

let gameCode = '';
let myName   = '';
let isHost   = false;
let gameData = null;
let pollId   = null;
let raiseAmt = 0;

const ROUNDS = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];

/* ── API helpers ───────────────────────────────── */
async function post(ep, body) {
  try {
    const r = await fetch(`/api/${ep}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Error'); return null; }
    return d;
  } catch(e) { toast('Connection error'); return null; }
}

async function get(ep) {
  try { const r = await fetch(`/api/${ep}`); return r.ok ? await r.json() : null; }
  catch(e) { return null; }
}

/* ── Polling ───────────────────────────────────── */
function startPoll() { stopPoll(); doPoll(); pollId = setInterval(doPoll, 2000); }
function stopPoll()  { if (pollId) { clearInterval(pollId); pollId = null; } }

async function doPoll() {
  if (!gameCode) return;
  const d = await get(`game-state?code=${gameCode}`);
  if (d && d.game) {
    const oldR = gameData ? gameData.roundIdx : -1;
    gameData = d.game;
    render();
    if (d.game.roundMessage && d.game.roundIdx !== oldR) tableMsg(d.game.roundMessage);
  }
}

/* ── Views ─────────────────────────────────────── */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('visible'));
  document.getElementById(id).classList.add('visible');
}

function switchTab(tab, e) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-body').forEach(b => b.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  if (e && e.target) e.target.classList.add('active');
}

function updateBid() {
  const el = document.getElementById('bid-display');
  if (el) el.textContent = Math.round(parseInt(document.getElementById('start-chips').value) / 40);
}

/* ── Create / Join ─────────────────────────────── */
async function createGame() {
  const name = document.getElementById('host-name').value.trim();
  if (!name) return toast('Enter your name');
  toast('Creating...');
  const d = await post('create-game', { name, chips: parseInt(document.getElementById('start-chips').value) });
  if (!d) return;
  gameCode = d.code; myName = name; gameData = d.game; isHost = true;
  save(); showView('game-view'); render(); startPoll();
  toast('Share code: ' + gameCode);
}

async function joinGame() {
  const name = document.getElementById('join-name').value.trim();
  const code = document.getElementById('game-code-input').value.trim().toUpperCase();
  if (!name) return toast('Enter your name');
  if (!code) return toast('Enter a code');
  toast('Joining...');
  const d = await post('join-game', { code, name });
  if (!d) return;
  gameCode = code; myName = name; gameData = d.game; isHost = false;
  save(); showView('game-view'); render(); startPoll();
  toast('Joined!');
}

function save() {
  localStorage.setItem('pk_name', myName);
  localStorage.setItem('pk_code', gameCode);
  localStorage.setItem('pk_host', isHost ? '1' : '');
}

/* ── Action helper ─────────────────────────────── */
async function act(action, extra = {}) {
  const d = await post('action', { code: gameCode, action, playerName: myName, ...extra });
  if (d && d.game) { gameData = d.game; render(); }
  return d;
}

/* ══════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════ */
function render() {
  if (!gameData) return;
  if (gameData.hostName && gameData.hostName.toLowerCase() === myName.toLowerCase()) isHost = true;

  // Top bar
  document.getElementById('code-pill').textContent = gameCode;
  document.getElementById('hand-badge').textContent = 'Hand ' + gameData.handNum;

  // Stats
  document.getElementById('pot-display').textContent = gameData.pot.toLocaleString();
  document.getElementById('call-display').textContent = (gameData.callAmount || 0).toLocaleString();

  // Rounds
  const rc = document.getElementById('round-pills');
  rc.innerHTML = '';
  ROUNDS.forEach((n, i) => {
    const p = document.createElement('span');
    p.className = 'rpill' + (i === gameData.roundIdx ? ' active' : '') + (i < gameData.roundIdx ? ' done' : '');
    p.textContent = n;
    rc.appendChild(p);
  });

  // Players
  renderPlayers();
  // Log
  renderLog();
  // Host bar
  document.getElementById('host-bar').style.display = isHost ? '' : 'none';
  // Showdown
  document.getElementById('showdown-bar').style.display = gameData.roundIdx === 4 ? '' : 'none';

  // My action bar: only visible if I haven't folded
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  const bar = document.getElementById('my-actions');
  if (me && !me.folded) {
    bar.style.display = '';
    const owed = (gameData.callAmount || 0) - me.bet;
    const callBtn = document.getElementById('btn-call');
    const checkBtn = document.getElementById('btn-check');
    if (owed > 0) {
      callBtn.style.display = ''; callBtn.textContent = `Call ${owed}`;
      checkBtn.style.display = 'none';
    } else {
      callBtn.style.display = 'none'; checkBtn.style.display = '';
    }
  } else {
    bar.style.display = 'none';
  }
}

function renderPlayers() {
  const g = document.getElementById('players-grid');
  g.innerHTML = '';
  gameData.players.forEach((p, i) => {
    const isMe = p.name.toLowerCase() === myName.toLowerCase();
    const el = document.createElement('div');
    el.className = 'pcard' + (p.folded ? ' folded' : '');

    let debtHtml = '';
    if (p.debts && p.debts.length) {
      debtHtml = '<div class="debt">';
      p.debts.forEach(d => {
        const can = d.from.toLowerCase() === myName.toLowerCase() && p.chips >= d.amount;
        debtHtml += `<div class="debt-row"><span>owes ${d.from}: ${d.amount}</span>${can ? `<button class="debt-collect" onclick="collectDebt('${p.name}')">Collect</button>` : ''}</div>`;
      });
      debtHtml += '</div>';
    }

    let loanHtml = '';
    if (!isMe && p.chips < (gameData.startingBid || 50)) {
      loanHtml = `<button class="loan-btn" onclick="openLoan('${p.name}')">💰 Loan</button>`;
    }

    el.innerHTML = `
      <div class="pcard-top">
        <div class="avatar">${p.name[0].toUpperCase()}${i === gameData.dealerIdx ? '<span class="dealer-d">D</span>' : ''}</div>
        <div><span class="pname">${p.name}</span>${isMe ? ' <span class="you-tag">(you)</span>' : ''}</div>
      </div>
      <div class="pchips-row">
        <span class="pchips-label">chips</span>
        <span class="pchips">${p.chips.toLocaleString()}</span>
      </div>
      ${p.bet > 0 ? `<span class="pbet">bet ${p.bet.toLocaleString()}</span>` : ''}
      <span class="fold-tag">FOLDED</span>
      ${debtHtml}${loanHtml}
    `;
    g.appendChild(el);
  });
}

function renderLog() {
  const el = document.getElementById('activity-log');
  el.innerHTML = '';
  if (!gameData.history || !gameData.history.length) {
    el.innerHTML = '<div class="log-row"><span class="log-x" style="color:var(--text-dim)">No activity yet</span></div>';
    return;
  }
  gameData.history.slice(0, 20).forEach(e => {
    const row = document.createElement('div');
    row.className = 'log-row';
    row.innerHTML = `<span class="log-t">${e.time}</span><span class="log-x">${e.text}</span>${e.amount != null ? `<span class="log-a">${Number(e.amount).toLocaleString()}</span>` : ''}`;
    el.appendChild(row);
  });
}

function tableMsg(msg) {
  const el = document.getElementById('table-msg');
  if (!msg) { el.classList.remove('visible'); return; }
  el.textContent = msg; el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 6000);
}

/* ── Player actions (only for YOURSELF) ────────── */
async function doFold() {
  if (!confirm('Fold?')) return;
  const d = await act('fold');
  if (d) {
    const a = d.game.players.filter(x => !x.folded);
    if (a.length === 1) { toast(`${a[0].name} wins! 🏆`); confetti(); }
    else toast('You folded');
  }
}

async function doCall() {
  const d = await act('call');
  if (d) { bumpPot(); toast('Done!'); }
}

/* ── Raise ─────────────────────────────────────── */
function openRaisePanel() {
  raiseAmt = 0;
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  document.getElementById('raise-max').textContent = me ? `max ${me.chips.toLocaleString()}` : '';
  document.getElementById('raise-big').textContent = '0';
  document.getElementById('raise-input').value = '';
  document.getElementById('raise-sheet').classList.add('open');
}

function closeRaise() { document.getElementById('raise-sheet').classList.remove('open'); }

function adjRaise(d) {
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  if (!me) return;
  raiseAmt = Math.max(0, Math.min(raiseAmt + d, me.chips));
  document.getElementById('raise-big').textContent = raiseAmt.toLocaleString();
  document.getElementById('raise-input').value = raiseAmt;
}

function setRaiseManual() {
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  if (!me) return;
  raiseAmt = Math.max(0, Math.min(parseInt(document.getElementById('raise-input').value) || 0, me.chips));
  document.getElementById('raise-big').textContent = raiseAmt.toLocaleString();
}

function raiseAllIn() {
  const me = gameData.players.find(p => p.name.toLowerCase() === myName.toLowerCase());
  if (!me) return;
  raiseAmt = me.chips;
  document.getElementById('raise-big').textContent = raiseAmt.toLocaleString();
  document.getElementById('raise-input').value = raiseAmt;
}

async function confirmRaise() {
  if (raiseAmt <= 0) return toast('Enter an amount');
  const d = await act('raise', { amount: raiseAmt });
  if (d) { bumpPot(); toast(`Raised ${raiseAmt}`); closeRaise(); }
}

function bumpPot() {
  const el = document.getElementById('pot-display');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

/* ── Host controls ─────────────────────────────── */
async function advanceRound() {
  const d = await act('advance-round');
  if (d && d.game.roundMessage) { tableMsg(d.game.roundMessage); toast(d.game.roundMessage); }
}

async function resetCallAmount() {
  const v = prompt('Set call amount to:', gameData.callAmount || 0);
  if (v === null) return;
  await act('reset-call', { amount: parseInt(v) || 0 });
  toast('Call amount updated');
}

async function newHand() {
  if (gameData.pot > 0 && !confirm('Chips still in pot! New hand?')) return;
  const d = await act('new-hand');
  if (d) toast(`Hand ${d.game.handNum}`);
}

/* ── Take from pot (modal) ─────────────────────── */
function openTakeModal() {
  if (!gameData || gameData.pot <= 0) return toast('Pot is empty');
  document.getElementById('take-max').textContent = gameData.pot.toLocaleString();
  const sel = document.getElementById('take-who');
  sel.innerHTML = '';
  gameData.players.forEach(p => { const o = document.createElement('option'); o.value = p.name; o.textContent = p.name; sel.appendChild(o); });
  document.getElementById('take-amt').value = '';
  document.getElementById('take-modal').classList.add('open');
}

async function confirmTake() {
  const who = document.getElementById('take-who').value;
  const amt = parseInt(document.getElementById('take-amt').value);
  if (!who || !amt || amt <= 0) return toast('Fill in the details');
  const d = await act('take-from-pot', { targetName: who, amount: amt });
  if (d) { toast(`${amt} → ${who}`); closeModal('take-modal'); }
}

/* ── Award pot (modal) ─────────────────────────── */
function openAwardModal() {
  if (!gameData || gameData.pot <= 0) return toast('Pot is empty');
  document.getElementById('pot-award-label').textContent = gameData.pot.toLocaleString() + ' chips';
  const btns = document.getElementById('winner-btns');
  btns.innerHTML = '';
  gameData.players.filter(p => !p.folded).forEach(p => {
    const b = document.createElement('button');
    b.className = 'btn-primary'; b.style.marginBottom = '8px';
    b.textContent = p.name;
    b.onclick = async () => {
      const d = await act('award-pot', { targetName: p.name });
      if (d) { toast(`${p.name} wins! 🏆`); confetti(); closeModal('award-modal'); }
    };
    btns.appendChild(b);
  });
  document.getElementById('award-modal').classList.add('open');
}

/* ── Loan / Debt ──────────────────────────────── */
let loanTarget = '';

function openLoan(name) {
  loanTarget = name;
  document.getElementById('loan-who').textContent = name;
  document.getElementById('loan-amt').value = '';
  document.getElementById('loan-modal').classList.add('open');
}

async function confirmLoan() {
  const amt = parseInt(document.getElementById('loan-amt').value);
  if (!amt || amt <= 0) return toast('Enter an amount');
  const d = await act('loan', { targetName: loanTarget, amount: amt });
  if (d) { toast('Loaned!'); closeModal('loan-modal'); }
}

async function collectDebt(borrowerName) {
  const d = await act('collect-debt', { targetName: borrowerName });
  if (d) toast('Collected!');
}

/* ── Modals helper ─────────────────────────────── */
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ── Leave / Share ─────────────────────────────── */
function leaveGame() {
  if (!confirm('Leave?')) return;
  stopPoll(); gameCode = ''; gameData = null;
  localStorage.removeItem('pk_code');
  showView('home-view');
}

function copyCode() {
  const txt = `Join my poker game! Code: ${gameCode}\n${location.origin}`;
  if (navigator.share) navigator.share({ title:'PokerChips.io', text:txt }).catch(() => fallback());
  else fallback();
}
function fallback() { navigator.clipboard.writeText(gameCode).catch(()=>{}); toast('Copied: ' + gameCode); }

/* ── Confetti ──────────────────────────────────── */
function confetti() {
  const colors = ['#f0c850','#f09040','#f06050','#5b9cf5','#44d688'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'confetti';
    p.style.left = Math.random()*100+'vw'; p.style.top = '-10px';
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDuration = (1.2+Math.random())+'s';
    p.style.animationDelay = (Math.random()*.5)+'s';
    const s = 5+Math.random()*5; p.style.width=s+'px'; p.style.height=s+'px';
    p.style.borderRadius = Math.random()>.5 ? '50%' : '2px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2500);
  }
}

/* ── Toast ─────────────────────────────────────── */
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── Init ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const cs = document.getElementById('start-chips');
  if (cs) { cs.addEventListener('change', updateBid); updateBid(); }

  // Close modals on overlay click
  document.querySelectorAll('.modal-bg').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));

  // Close raise sheet on backdrop
  document.getElementById('raise-sheet').addEventListener('click', e => { if (e.target.classList.contains('raise-sheet')) closeRaise(); });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-bg.open').forEach(m => m.classList.remove('open'));
      closeRaise();
    }
  });

  // Restore from localStorage
  const n = localStorage.getItem('pk_name');
  const c = localStorage.getItem('pk_code');
  if (n) { document.getElementById('join-name').value = n; document.getElementById('host-name').value = n; }
  if (c) document.getElementById('game-code-input').value = c;
  if (localStorage.getItem('pk_host') === '1') isHost = true;
});
