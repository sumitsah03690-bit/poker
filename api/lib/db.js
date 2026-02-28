// MongoDB connection singleton for Vercel serverless functions
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI environment variable not set');

let cachedClient = null;
let cachedDb = null;

async function connectToDb() {
  if (cachedDb) return cachedDb;

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db('poker');
  return cachedDb;
}

async function getGamesCollection() {
  const db = await connectToDb();
  return db.collection('games');
}

module.exports = { connectToDb, getGamesCollection };
