const { getGamesCollection } = require('./lib/db');

function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addHistory(game, text, amount) {
  game.history.unshift({ time: ts(), text, amount: amount || null });
  if (game.history.length > 60) game.history.pop();
}

function calcStartingBid(chips) {
  return Math.round(chips / 40);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, action, playerIdx, amount, targetIdx, targetName } = req.body;

    if (!code || !action) {
      return res.status(400).json({ error: 'Code and action are required' });
    }

    const games = await getGamesCollection();
    const game = await games.findOne({ code: code.toUpperCase() });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Process action
    switch (action) {

      case 'fold': {
        const p = game.players[playerIdx];
        if (!p || p.folded) break;
        p.folded = true;
        addHistory(game, `${p.name} folds`);

        // Auto-win if only 1 left
        const active = game.players.filter(x => !x.folded);
        if (active.length === 1) {
          const winner = active[0];
          winner.chips += game.pot;
          addHistory(game, `${winner.name} wins (last standing)`, game.pot);
          game.pot = 0;
          // Start new hand
          game.handNum++;
          game.roundIdx = 0;
          game.players.forEach(pl => { pl.bet = 0; pl.folded = false; });
          game.dealerIdx = (game.dealerIdx + 1) % game.players.length;
          if (game.players.length >= 2) {
            const bidIdx = (game.dealerIdx + 1) % game.players.length;
            const bidder = game.players[bidIdx];
            const bid = Math.min(game.startingBid, bidder.chips);
            bidder.chips -= bid;
            bidder.bet = bid;
            game.pot = bid;
            addHistory(game, `${bidder.name} posts bid`, bid);
          }
          addHistory(game, `Hand ${game.handNum} begins`);
        }
        break;
      }

      case 'call': {
        const p = game.players[playerIdx];
        if (!p || p.folded) break;
        const currentMax = Math.max(...game.players.map(x => x.bet));
        if (p.bet >= currentMax) {
          addHistory(game, `${p.name} checks`);
        } else {
          const callAmt = currentMax - p.bet;
          const actual = Math.min(callAmt, p.chips);
          p.chips -= actual;
          p.bet += actual;
          game.pot += actual;
          addHistory(game, `${p.name} calls`, actual);
        }
        break;
      }

      case 'raise': {
        const p = game.players[playerIdx];
        if (!p || p.folded) break;
        let amt = parseInt(amount) || 0;
        if (amt <= 0) break;
        amt = Math.min(amt, p.chips);
        p.chips -= amt;
        p.bet += amt;
        game.pot += amt;
        addHistory(game, p.chips === 0 ? `${p.name} ALL IN` : `${p.name} raises`, amt);
        break;
      }

      case 'advance-round': {
        const ROUNDS = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];
        if (game.roundIdx < ROUNDS.length - 1) {
          game.roundIdx++;
          game.players.forEach(pl => { pl.bet = 0; });
          addHistory(game, `Street: ${ROUNDS[game.roundIdx]}`);
        }
        break;
      }

      case 'award-pot': {
        const winner = game.players[playerIdx];
        if (!winner) break;
        const won = game.pot;
        winner.chips += won;
        addHistory(game, `${winner.name} wins the pot`, won);
        game.pot = 0;

        // New hand
        game.handNum++;
        game.roundIdx = 0;
        game.players.forEach(pl => { pl.bet = 0; pl.folded = false; });
        game.dealerIdx = (game.dealerIdx + 1) % game.players.length;
        if (game.players.length >= 2) {
          const bidIdx = (game.dealerIdx + 1) % game.players.length;
          const bidder = game.players[bidIdx];
          const bid = Math.min(game.startingBid, bidder.chips);
          bidder.chips -= bid;
          bidder.bet = bid;
          game.pot = bid;
          addHistory(game, `${bidder.name} posts bid`, bid);
        }
        addHistory(game, `Hand ${game.handNum} begins`);
        break;
      }

      case 'new-hand': {
        game.handNum++;
        game.roundIdx = 0;
        game.pot = 0;
        game.players.forEach(pl => { pl.bet = 0; pl.folded = false; });
        game.dealerIdx = (game.dealerIdx + 1) % game.players.length;
        if (game.players.length >= 2) {
          const bidIdx = (game.dealerIdx + 1) % game.players.length;
          const bidder = game.players[bidIdx];
          const bid = Math.min(game.startingBid, bidder.chips);
          bidder.chips -= bid;
          bidder.bet = bid;
          game.pot = bid;
          addHistory(game, `${bidder.name} posts bid`, bid);
        }
        addHistory(game, `Hand ${game.handNum} begins`);
        break;
      }

      case 'take-from-pot': {
        const tName = (targetName || '').trim();
        const tAmt = parseInt(amount) || 0;
        if (!tName || tAmt <= 0) break;
        const target = game.players.find(pl => pl.name.toLowerCase() === tName.toLowerCase());
        if (!target) break;
        const actual = Math.min(tAmt, game.pot);
        game.pot -= actual;
        target.chips += actual;
        addHistory(game, `↩ ${actual} returned to ${target.name}`, actual);
        break;
      }

      case 'loan': {
        const lender = game.players[playerIdx];
        const borrower = game.players[targetIdx];
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
        const collector = game.players[playerIdx];
        const debtor = game.players[targetIdx];
        if (!collector || !debtor) break;
        const debtIdx = debtor.debts.findIndex(d => d.from === collector.name);
        if (debtIdx < 0) break;
        const debt = debtor.debts[debtIdx];
        if (debtor.chips < debt.amount) break;
        debtor.chips -= debt.amount;
        collector.chips += debt.amount;
        addHistory(game, `${collector.name} collected debt from ${debtor.name}`, debt.amount);
        debtor.debts.splice(debtIdx, 1);
        break;
      }

      default:
        return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    // Save updated game
    await games.updateOne(
      { code: code.toUpperCase() },
      { $set: { players: game.players, pot: game.pot, roundIdx: game.roundIdx, handNum: game.handNum, dealerIdx: game.dealerIdx, history: game.history } }
    );

    return res.status(200).json({ game });
  } catch (err) {
    console.error('action error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
