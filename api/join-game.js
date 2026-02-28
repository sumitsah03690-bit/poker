const { getGamesCollection } = require('./lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, name } = req.body;

    if (!code || !name || !name.trim()) {
      return res.status(400).json({ error: 'Code and name are required' });
    }

    const games = await getGamesCollection();
    const game = await games.findOne({ code: code.toUpperCase() });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const trimName = name.trim();

    // Check if name already exists
    const exists = game.players.find(p => p.name.toLowerCase() === trimName.toLowerCase());
    if (exists) {
      // Player is re-joining — just return the game
      return res.status(200).json({ game, playerIdx: game.players.findIndex(p => p.name.toLowerCase() === trimName.toLowerCase()) });
    }

    // Add new player
    const newPlayer = {
      name: trimName,
      chips: game.startingChips,
      bet: 0,
      folded: false,
      hasActed: false,
      debts: []
    };

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await games.updateOne(
      { code: code.toUpperCase() },
      {
        $push: {
          players: newPlayer,
          history: {
            $each: [{ time: ts, text: `${trimName} joined`, amount: null }],
            $position: 0
          }
        }
      }
    );

    const updated = await games.findOne({ code: code.toUpperCase() });
    const playerIdx = updated.players.findIndex(p => p.name.toLowerCase() === trimName.toLowerCase());

    return res.status(200).json({ game: updated, playerIdx });
  } catch (err) {
    console.error('join-game error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
