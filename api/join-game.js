// POST /api/join-game
// Body: { code: string, name: string }
// Returns: { game, playerIdx }
const { getGamesCollection } = require('./lib/db');

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { code, name } = req.body;
  if (!code || !name || !name.trim()) return res.status(400).json({ error: 'Code and name required' });

  try {
    const col = await getGamesCollection();
    const game = await col.findOne({ code: code.toUpperCase() });
    if (!game) return res.status(404).json({ error: 'Game not found — check the code' });

    const trimName = name.trim();

    // Already in game? Return current state (re-join)
    const existIdx = game.players.findIndex(p => p.name.toLowerCase() === trimName.toLowerCase());
    if (existIdx >= 0) {
      return res.status(200).json({ game, playerIdx: existIdx });
    }

    // Add new player
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newPlayer = { name: trimName, chips: game.startingChips, bet: 0, folded: false, debts: [] };

    game.players.push(newPlayer);
    game.history.unshift({ time: timeStr, text: `${trimName} joined the table`, amount: null });

    // If this is the 2nd player joining, post the starting bid to kick off the game
    if (game.players.length === 2 && game.pot === 0) {
      const bidderIdx = (game.dealerIdx + 1) % game.players.length;
      const bidder = game.players[bidderIdx];
      const bid = Math.min(game.startingBid, bidder.chips);
      bidder.chips -= bid;
      bidder.bet = bid;
      game.pot = bid;
      game.callAmount = bid;
      game.history.unshift({ time: timeStr, text: `${bidder.name} posts starting bid`, amount: bid });
    }

    await col.updateOne({ code: code.toUpperCase() }, { $set: {
      players: game.players,
      pot: game.pot,
      callAmount: game.callAmount,
      history: game.history
    }});

    const playerIdx = game.players.findIndex(p => p.name.toLowerCase() === trimName.toLowerCase());
    return res.status(200).json({ game, playerIdx });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
