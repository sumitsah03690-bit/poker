const { getGamesCollection } = require('./lib/db');

function randomCode() {
  const chars = 'ACEKQJ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function calcStartingBid(chips) {
  return Math.round(chips / 40);
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, chips } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const startingChips = parseInt(chips) || 2000;
    const startingBid = calcStartingBid(startingChips);

    // Generate unique code
    const games = await getGamesCollection();
    let code;
    let attempts = 0;
    do {
      code = randomCode();
      const existing = await games.findOne({ code });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const game = {
      code,
      startingChips,
      startingBid,
      pot: 0,
      roundIdx: 0,
      handNum: 1,
      dealerIdx: 0,
      hostName: name.trim(),
      players: [
        {
          name: name.trim(),
          chips: startingChips,
          bet: 0,
          folded: false,
          debts: []
        }
      ],
      history: [
        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `${name.trim()} created the game`, amount: null }
      ],
      createdAt: new Date()
    };

    await games.insertOne(game);

    return res.status(200).json({ code, game });
  } catch (err) {
    console.error('create-game error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
