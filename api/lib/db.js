// MongoDB connection singleton for Vercel serverless functions.
// Reuses connection across warm invocations.
const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function getDB() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI env var not set');
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('poker');
  return db;
}

async function getGamesCollection() {
  const database = await getDB();
  const col = database.collection('games');
  // TTL index: auto-delete games older than 2 days (172800 seconds)
  await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 172800 }).catch(() => {});
  return col;
}

module.exports = { getGamesCollection };
