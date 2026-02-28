const { getGamesCollection } = require('./lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const games = await getGamesCollection();
    const game = await games.findOne({ code: code.toUpperCase() }, { projection: { _id: 0 } });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    return res.status(200).json({ game });
  } catch (err) {
    console.error('game-state error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
