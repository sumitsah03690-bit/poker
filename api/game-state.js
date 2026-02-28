// GET /api/game-state?code=XXXXX
// Returns: { game }
const { getGamesCollection } = require('./lib/db');

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const code = (req.query.code || '').toUpperCase();
  if (!code) return res.status(400).json({ error: 'Code required' });

  try {
    const col = await getGamesCollection();
    const game = await col.findOne({ code });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    return res.status(200).json({ game });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
