const { getGamesCollection } = require('./lib/db');

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addHistory(game, text, amount) {
  game.history.unshift({ time: ts(), text, amount: amount || null });
  if (game.history.length > 60) game.history.pop();
}

// Start a new hand
function startNewHand(game) {
  game.handNum++;
  game.roundIdx = 0;
  game.pot = 0;
  game.callAmount = 0;
  game.roundMessage = '';
  game.players.forEach(p => { p.bet = 0; p.folded = false; });
  game.dealerIdx = (game.dealerIdx + 1) % game.players.length;

  // Post starting bid
  if (game.players.length >= 2) {
    const bidIdx = (game.dealerIdx + 1) % game.players.length;
    const bidder = game.players[bidIdx];
    const bid = Math.min(game.startingBid, bidder.chips);
    bidder.chips -= bid;
    bidder.bet = bid;
    game.pot = bid;
    game.callAmount = bid;
    addHistory(game, `${bidder.name} posts bid`, bid);
  }

  addHistory(game, `Hand ${game.handNum} begins`);
}

function getRoundMessage(idx) {
  return ['', '🃏 Deal 3 community cards face up', '🃏 Deal the 4th community card', '🃏 Deal the 5th and final card', '🏆 Reveal hands — award the pot!'][idx] || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code, action, playerName, amount, targetName } = req.body;
    if (!code || !action) return res.status(400).json({ error: 'Code and action required' });

    const games = await getGamesCollection();
    const game = await games.findOne({ code: code.toUpperCase() });
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const playerIdx = game.players.findIndex(p => p.name.toLowerCase() === (playerName || '').toLowerCase());

    switch (action) {

      case 'fold': {
        if (playerIdx < 0) return res.status(400).json({ error: 'Player not found' });
        const p = game.players[playerIdx];
        if (p.folded) break;
        p.folded = true;
        addHistory(game, `${p.name} folds`);

        // Auto-win if only 1 left
        const active = game.players.filter(x => !x.folded);
        if (active.length === 1) {
          const winner = active[0];
          winner.chips += game.pot;
          addHistory(game, `${winner.name} wins (last standing)`, game.pot);
          game.pot = 0;
          startNewHand(game);
        }
        break;
      }

      case 'call': {
        if (playerIdx < 0) return res.status(400).json({ error: 'Player not found' });
        const p = game.players[playerIdx];
        if (p.folded) break;
        const callAmt = game.callAmount - p.bet;
        if (callAmt <= 0) {
          addHistory(game, `${p.name} checks`);
        } else {
          const actual = Math.min(callAmt, p.chips);
          p.chips -= actual;
          p.bet += actual;
          game.pot += actual;
          addHistory(game, `${p.name} calls`, actual);
        }
        break;
      }

      case 'raise': {
        if (playerIdx < 0) return res.status(400).json({ error: 'Player not found' });
        const p = game.players[playerIdx];
        if (p.folded) break;
        let amt = parseInt(amount) || 0;
        if (amt <= 0) break;
        amt = Math.min(amt, p.chips);
        p.chips -= amt;
        p.bet += amt;
        game.pot += amt;
        // Update call amount if this player's total bet is higher
        if (p.bet > game.callAmount) {
          game.callAmount = p.bet;
        }
        addHistory(game, p.chips === 0 ? `${p.name} ALL IN` : `${p.name} raises`, amt);
        break;
      }

      case 'advance-round': {
        const ROUNDS = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];
        if (game.roundIdx < ROUNDS.length - 1) {
          game.roundIdx++;
          // Reset bets for new street but keep call amount at 0
          game.players.forEach(p => { p.bet = 0; });
          game.callAmount = 0;
          game.roundMessage = getRoundMessage(game.roundIdx);
          addHistory(game, `Street: ${ROUNDS[game.roundIdx]}`);
        }
        break;
      }

      case 'reset-call': {
        // Host can reset call amount
        const newCall = parseInt(amount) || 0;
        game.callAmount = Math.max(0, newCall);
        addHistory(game, `Call reset to ${game.callAmount}`);
        break;
      }

      case 'award-pot': {
        const tName = (targetName || '').trim();
        const winner = game.players.find(p => p.name.toLowerCase() === tName.toLowerCase());
        if (!winner) break;
        const won = game.pot;
        winner.chips += won;
        addHistory(game, `${winner.name} wins the pot`, won);
        game.pot = 0;
        startNewHand(game);
        break;
      }

      case 'new-hand': {
        startNewHand(game);
        break;
      }

      case 'take-from-pot': {
        const tName2 = (targetName || '').trim();
        const tAmt = parseInt(amount) || 0;
        if (!tName2 || tAmt <= 0) break;
        const target = game.players.find(p => p.name.toLowerCase() === tName2.toLowerCase());
        if (!target) break;
        const actual = Math.min(tAmt, game.pot);
        game.pot -= actual;
        target.chips += actual;
        addHistory(game, `↩ ${actual} returned to ${target.name}`, actual);
        break;
      }

      case 'loan': {
        const lender = game.players.find(p => p.name.toLowerCase() === (playerName || '').toLowerCase());
        const borrower = game.players.find(p => p.name.toLowerCase() === (targetName || '').toLowerCase());
        const loanAmt = parseInt(amount) || 0;
        if (!lender || !borrower || loanAmt <= 0 || loanAmt > lender.chips) break;
        lender.chips -= loanAmt;
        borrower.chips += loanAmt;
        const existing = borrower.debts.find(d => d.from === lender.name);
        if (existing) { existing.amount += loanAmt; }
        else { borrower.debts.push({ from: lender.name, amount: loanAmt }); }
        addHistory(game, `${lender.name} loaned to ${borrower.name}`, loanAmt);
        break;
      }

      case 'collect-debt': {
        const collector = game.players.find(p => p.name.toLowerCase() === (playerName || '').toLowerCase());
        const debtor = game.players.find(p => p.name.toLowerCase() === (targetName || '').toLowerCase());
        if (!collector || !debtor) break;
        const debtIdx = debtor.debts.findIndex(d => d.from === collector.name);
        if (debtIdx < 0) break;
        const debt = debtor.debts[debtIdx];
        if (debtor.chips < debt.amount) break;
        debtor.chips -= debt.amount;
        collector.chips += debt.amount;
        addHistory(game, `${collector.name} collected from ${debtor.name}`, debt.amount);
        debtor.debts.splice(debtIdx, 1);
        break;
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    // Save
    await games.updateOne(
      { code: code.toUpperCase() },
      {
        $set: {
          players: game.players,
          pot: game.pot,
          callAmount: game.callAmount,
          roundIdx: game.roundIdx,
          handNum: game.handNum,
          dealerIdx: game.dealerIdx,
          roundMessage: game.roundMessage || '',
          history: game.history
        }
      }
    );

    return res.status(200).json({ game });
  } catch (err) {
    console.error('action error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
