// Reel's MongoDB. It uses the same cluster as the rest of the site (MONGODB_URI)
// but its own database, MOVIES_DB (default "reel").
import { MongoClient } from 'mongodb';

const DB_NAME = process.env.MOVIES_DB || 'reel';

// One client per server instance, kept across hot reloads and warm invocations
function client() {
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('Reel needs MONGODB_URI on the server.'), { status: 503 });
  if (!global.__reelMongo) {
    global.__reelMongo = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 }).connect()
      .then(async c => {
        const db = c.db(DB_NAME);
        await Promise.all([
          db.collection('movies').createIndex({ videoId: 1 }, { unique: true }),
          db.collection('movies').createIndex({ addedAt: -1 }),
          db.collection('logins').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        ]);
        return c;
      })
      .catch(err => { global.__reelMongo = null; throw err; });
  }
  return global.__reelMongo;
}

export async function db() {
  return (await client()).db(DB_NAME);
}
