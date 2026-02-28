// POST /api/create-game
// Body: { name: string, chips: number }
// Returns: { code, game }
const { getGamesCollection } = require('./lib/db');

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { name, chips } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const startingChips = parseInt(chips) || 2000;
  const startingBid = Math.round(startingChips / 40);

  // Generate 5-char code
  const chars = 'ACEKQJ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const game = {
    code,
    hostName: name.trim(),
    startingChips,
    startingBid,
    pot: 0,
    callAmount: 0,
    roundIdx: 0,         // 0=Pre-flop,1=Flop,2=Turn,3=River,4=Showdown
    handNum: 1,
    dealerIdx: 0,
    players: [
      { name: name.trim(), chips: startingChips, bet: 0, folded: false, debts: [] }
    ],
    history: [
      { time: timeStr, text: `${name.trim()} created the game`, amount: null }
    ],
    createdAt: now
  };

  try {
    const col = await getGamesCollection();
    await col.insertOne(game);
    return res.status(200).json({ code, game });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
