// POST /api/action
// Body: { code, action, playerName, amount?, targetName? }
// Returns: { game }
//
// ACTIONS:
//   fold         — player folds (auto-win if 1 left)
//   call         — player matches callAmount (or checks if already matched)
//   raise        — player adds amount, callAmount updates if their total bet > current call
//   advance-round — host moves to next street, resets bets & callAmount to 0
//   reset-call   — host sets callAmount to any value
//   award-pot    — give pot to targetName, then start new hand
//   new-hand     — reset bets/folded, rotate dealer, post starting bid
//   take-from-pot — return amount from pot to targetName
//   loan         — playerName gives amount to targetName (creates debt)
//   collect-debt — playerName collects their debt from targetName

const { getGamesCollection } = require('./lib/db');

const ROUND_NAMES = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];
const ROUND_MSGS  = [
  '',
  '🃏 Deal 3 community cards face up',
  '🃏 Deal the 4th community card',
  '🃏 Deal the 5th and final card',
  '🏆 Reveal hands — award the pot!'
];

function timeStr() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function log(game, text, amount) {
  game.history.unshift({ time: timeStr(), text, amount: amount ?? null });
  if (game.history.length > 60) game.history.length = 60;
}

function newHand(game) {
  game.handNum++;
  game.roundIdx = 0;
  game.pot = 0;
  game.callAmount = 0;
  game.roundMessage = '';
  game.players.forEach(p => { p.bet = 0; p.folded = false; });
  game.dealerIdx = (game.dealerIdx + 1) % game.players.length;

  // Post starting bid from player left of dealer
  if (game.players.length >= 2) {
    const i = (game.dealerIdx + 1) % game.players.length;
    const p = game.players[i];
    const bid = Math.min(game.startingBid, p.chips);
    p.chips -= bid;
    p.bet = bid;
    game.pot = bid;
    game.callAmount = bid;
    log(game, `${p.name} posts bid`, bid);
  }

  log(game, `— Hand ${game.handNum} —`);
}

function saveFields(game) {
  return {
    players: game.players,
    pot: game.pot,
    callAmount: game.callAmount,
    roundIdx: game.roundIdx,
    handNum: game.handNum,
    dealerIdx: game.dealerIdx,
    roundMessage: game.roundMessage || '',
    history: game.history
  };
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { code, action, playerName, amount, targetName } = req.body;
  if (!code || !action) return res.status(400).json({ error: 'code and action required' });

  try {
    const col = await getGamesCollection();
    const game = await col.findOne({ code: code.toUpperCase() });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Find the acting player
    const me = game.players.find(p => p.name.toLowerCase() === (playerName || '').toLowerCase());

    switch (action) {

      // ── FOLD ──────────────────────────────────────────────
      case 'fold': {
        if (!me) return res.status(400).json({ error: 'Player not found' });
        if (me.folded) break;
        me.folded = true;
        log(game, `${me.name} folds`);

        // Auto-win if only 1 active player left
        const active = game.players.filter(p => !p.folded);
        if (active.length === 1) {
          active[0].chips += game.pot;
          log(game, `${active[0].name} wins (last standing)`, game.pot);
          game.pot = 0;
          newHand(game);
        }
        break;
      }

      // ── CALL / CHECK ──────────────────────────────────────
      case 'call': {
        if (!me) return res.status(400).json({ error: 'Player not found' });
        if (me.folded) break;
        const owed = game.callAmount - me.bet;
        if (owed <= 0) {
          log(game, `${me.name} checks`);
        } else {
          const pay = Math.min(owed, me.chips);
          me.chips -= pay;
          me.bet += pay;
          game.pot += pay;
          log(game, `${me.name} calls`, pay);
        }
        break;
      }

      // ── RAISE ─────────────────────────────────────────────
      case 'raise': {
        if (!me) return res.status(400).json({ error: 'Player not found' });
        if (me.folded) break;
        let amt = parseInt(amount) || 0;
        if (amt <= 0) return res.status(400).json({ error: 'Amount must be > 0' });
        amt = Math.min(amt, me.chips);
        me.chips -= amt;
        me.bet += amt;
        game.pot += amt;
        // If their total bet exceeds current call, call amount goes up
        if (me.bet > game.callAmount) game.callAmount = me.bet;
        log(game, me.chips === 0 ? `${me.name} ALL IN 🔥` : `${me.name} raises`, amt);
        break;
      }

      // ── ADVANCE ROUND (host) ──────────────────────────────
      case 'advance-round': {
        if (game.roundIdx < ROUND_NAMES.length - 1) {
          game.roundIdx++;
          game.players.forEach(p => { p.bet = 0; }); // reset bets for new street
          // callAmount stays the same — players must still match it
          game.roundMessage = ROUND_MSGS[game.roundIdx];
          log(game, `→ ${ROUND_NAMES[game.roundIdx]}`);
        }
        break;
      }

      // ── RESET CALL (host) ─────────────────────────────────
      case 'reset-call': {
        game.callAmount = Math.max(0, parseInt(amount) || 0);
        log(game, `Call set to ${game.callAmount}`);
        break;
      }

      // ── AWARD POT ─────────────────────────────────────────
      case 'award-pot': {
        const winner = game.players.find(p => p.name.toLowerCase() === (targetName || '').toLowerCase());
        if (!winner) return res.status(400).json({ error: 'Player not found' });
        winner.chips += game.pot;
        log(game, `🏆 ${winner.name} wins the pot!`, game.pot);
        game.pot = 0;
        newHand(game);
        break;
      }

      // ── NEW HAND ──────────────────────────────────────────
      case 'new-hand': {
        newHand(game);
        break;
      }

      // ── TAKE FROM POT ────────────────────────────────────
      case 'take-from-pot': {
        const target = game.players.find(p => p.name.toLowerCase() === (targetName || '').toLowerCase());
        if (!target) return res.status(400).json({ error: 'Player not found' });
        const takeAmt = Math.min(parseInt(amount) || 0, game.pot);
        if (takeAmt <= 0) break;
        game.pot -= takeAmt;
        target.chips += takeAmt;
        log(game, `↩ ${takeAmt} returned to ${target.name}`, takeAmt);
        break;
      }

      // ── LOAN ──────────────────────────────────────────────
      case 'loan': {
        if (!me) return res.status(400).json({ error: 'Lender not found' });
        const borrower = game.players.find(p => p.name.toLowerCase() === (targetName || '').toLowerCase());
        if (!borrower) return res.status(400).json({ error: 'Borrower not found' });
        const loanAmt = parseInt(amount) || 0;
        if (loanAmt <= 0 || loanAmt > me.chips) return res.status(400).json({ error: 'Invalid amount' });
        me.chips -= loanAmt;
        borrower.chips += loanAmt;
        // Track debt
        const existing = borrower.debts.find(d => d.from === me.name);
        if (existing) existing.amount += loanAmt;
        else borrower.debts.push({ from: me.name, amount: loanAmt });
        log(game, `${me.name} loaned ${borrower.name}`, loanAmt);
        break;
      }

      // ── COLLECT DEBT ──────────────────────────────────────
      case 'collect-debt': {
        if (!me) return res.status(400).json({ error: 'Collector not found' });
        const debtor = game.players.find(p => p.name.toLowerCase() === (targetName || '').toLowerCase());
        if (!debtor) return res.status(400).json({ error: 'Debtor not found' });
        const di = debtor.debts.findIndex(d => d.from === me.name);
        if (di < 0) return res.status(400).json({ error: 'No debt found' });
        const debt = debtor.debts[di];
        if (debtor.chips < debt.amount) return res.status(400).json({ error: 'Not enough chips' });
        debtor.chips -= debt.amount;
        me.chips += debt.amount;
        log(game, `${me.name} collected debt from ${debtor.name}`, debt.amount);
        debtor.debts.splice(di, 1);
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    // Persist
    await col.updateOne({ code: code.toUpperCase() }, { $set: saveFields(game) });
    return res.status(200).json({ game });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
