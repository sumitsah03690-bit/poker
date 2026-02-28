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

// Check if betting round is complete (all active players matched the bet)
function isBettingComplete(game) {
  const activePlayers = game.players.filter(p => !p.folded && p.chips > 0);
  if (activePlayers.length <= 1) return true;

  const maxBet = Math.max(...game.players.map(p => p.bet));
  // All active players must have acted and matched the current bet
  return activePlayers.every(p => p.bet === maxBet && p.hasActed);
}

// Advance to next active player
function nextPlayer(game) {
  const n = game.players.length;
  let next = (game.currentPlayerIdx + 1) % n;
  let tries = 0;
  while ((game.players[next].folded || game.players[next].chips === 0) && tries < n) {
    next = (next + 1) % n;
    tries++;
  }
  game.currentPlayerIdx = next;
}

// Start a new betting round (new street)
function startNewBettingRound(game) {
  game.players.forEach(p => { p.bet = 0; p.hasActed = false; });
  // First active player after dealer starts
  game.currentPlayerIdx = game.dealerIdx;
  nextPlayer(game);
}

// Auto-advance round when betting is complete
function checkAndAdvanceRound(game) {
  if (!isBettingComplete(game)) return false;

  const ROUNDS = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];

  if (game.roundIdx < ROUNDS.length - 1) {
    game.roundIdx++;
    game.roundMessage = getRoundMessage(game.roundIdx);
    addHistory(game, `Street: ${ROUNDS[game.roundIdx]}`);
    startNewBettingRound(game);
    return true;
  }
  return false;
}

function getRoundMessage(roundIdx) {
  const messages = [
    '',
    '🃏 Deal 3 community cards face up',
    '🃏 Deal the 4th community card',
    '🃏 Deal the 5th and final card',
    '🏆 Reveal hands — award the pot!'
  ];
  return messages[roundIdx] || '';
}

// Start a brand new hand
function startNewHand(game) {
  game.handNum++;
  game.roundIdx = 0;
  game.pot = 0;
  game.roundMessage = '';
  game.players.forEach(p => { p.bet = 0; p.folded = false; p.hasActed = false; });
  game.dealerIdx = (game.dealerIdx + 1) % game.players.length;

  // Post starting bid from player left of dealer
  if (game.players.length >= 2) {
    const bidIdx = (game.dealerIdx + 1) % game.players.length;
    const bidder = game.players[bidIdx];
    const bid = Math.min(game.startingBid, bidder.chips);
    bidder.chips -= bid;
    bidder.bet = bid;
    game.pot = bid;
    addHistory(game, `${bidder.name} posts bid`, bid);

    // First player to act is left of bid poster
    game.currentPlayerIdx = (bidIdx + 1) % game.players.length;
    // Skip folded/busted players
    let tries = 0;
    while ((game.players[game.currentPlayerIdx].folded || game.players[game.currentPlayerIdx].chips === 0) && tries < game.players.length) {
      game.currentPlayerIdx = (game.currentPlayerIdx + 1) % game.players.length;
      tries++;
    }
  }

  addHistory(game, `Hand ${game.handNum} begins`);
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
    const { code, action, playerName, amount, targetIdx, targetName } = req.body;

    if (!code || !action) {
      return res.status(400).json({ error: 'Code and action required' });
    }

    const games = await getGamesCollection();
    const game = await games.findOne({ code: code.toUpperCase() });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Find player by name
    const playerIdx = game.players.findIndex(p => p.name.toLowerCase() === (playerName || '').toLowerCase());

    switch (action) {

      case 'fold': {
        // Validate it's this player's turn
        if (playerIdx !== game.currentPlayerIdx) {
          return res.status(400).json({ error: 'Not your turn!' });
        }
        const p = game.players[playerIdx];
        if (!p || p.folded) break;
        p.folded = true;
        p.hasActed = true;
        addHistory(game, `${p.name} folds`);

        // Check if only 1 player left
        const active = game.players.filter(x => !x.folded);
        if (active.length === 1) {
          const winner = active[0];
          winner.chips += game.pot;
          addHistory(game, `${winner.name} wins (last standing)`, game.pot);
          game.pot = 0;
          startNewHand(game);
        } else {
          nextPlayer(game);
          checkAndAdvanceRound(game);
        }
        break;
      }

      case 'call': {
        if (playerIdx !== game.currentPlayerIdx) {
          return res.status(400).json({ error: 'Not your turn!' });
        }
        const p = game.players[playerIdx];
        if (!p || p.folded) break;

        const maxBet = Math.max(...game.players.map(x => x.bet));
        if (p.bet >= maxBet) {
          // It's a check
          p.hasActed = true;
          addHistory(game, `${p.name} checks`);
        } else {
          const callAmt = maxBet - p.bet;
          const actual = Math.min(callAmt, p.chips);
          p.chips -= actual;
          p.bet += actual;
          game.pot += actual;
          p.hasActed = true;
          addHistory(game, `${p.name} calls`, actual);
        }

        nextPlayer(game);
        checkAndAdvanceRound(game);
        break;
      }

      case 'raise': {
        if (playerIdx !== game.currentPlayerIdx) {
          return res.status(400).json({ error: 'Not your turn!' });
        }
        const p = game.players[playerIdx];
        if (!p || p.folded) break;
        let amt = parseInt(amount) || 0;
        if (amt <= 0) break;
        amt = Math.min(amt, p.chips);
        p.chips -= amt;
        p.bet += amt;
        game.pot += amt;
        p.hasActed = true;

        // When someone raises, everyone else needs to act again
        game.players.forEach((pl, i) => {
          if (i !== playerIdx && !pl.folded && pl.chips > 0) {
            pl.hasActed = false;
          }
        });

        addHistory(game, p.chips === 0 ? `${p.name} ALL IN` : `${p.name} raises`, amt);
        nextPlayer(game);
        break;
      }

      case 'award-pot': {
        const winnerIdx = game.players.findIndex(p => p.name.toLowerCase() === (targetName || '').toLowerCase());
        const winner = game.players[winnerIdx];
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
        const lender = game.players.find(p => p.name.toLowerCase() === (playerName || '').toLowerCase());
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
        const collector = game.players.find(p => p.name.toLowerCase() === (playerName || '').toLowerCase());
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
        return res.status(400).json({ error: 'Unknown action' });
    }

    // Save
    await games.updateOne(
      { code: code.toUpperCase() },
      {
        $set: {
          players: game.players,
          pot: game.pot,
          roundIdx: game.roundIdx,
          handNum: game.handNum,
          dealerIdx: game.dealerIdx,
          currentPlayerIdx: game.currentPlayerIdx,
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
