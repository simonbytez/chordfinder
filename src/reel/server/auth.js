// Reel is private: one password unlocks it, and a signed, HttpOnly cookie keeps
// you signed in for 60 days. The password starts out as MOVIES_PASSWORD. Once
// it's changed in the app, a scrypt hash of the new one is kept in the database
// and MOVIES_PASSWORD is ignored. Changing the password signs everyone out,
// because the cookie's signature is keyed on it.
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { db } from './db';

const scrypt = promisify(scryptCb);
const COOKIE = 'reel_session';
const DAYS = 60;
export const MIN_LENGTH = 6;

function same(a, b) {
  const h = s => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(a), h(b));
}

async function derive(password, salt) {
  return (await scrypt(String(password), salt, 32)).toString('hex');
}

// The password in use, or null if there isn't one yet
async function current() {
  const saved = process.env.MONGODB_URI ? await (await db()).collection('settings').findOne({ _id: 'password' }) : null;
  if (saved) return { secret: saved.hash, matches: async guess => same(await derive(guess, saved.salt), saved.hash) };
  const env = process.env.MOVIES_PASSWORD;
  if (env) return { secret: env, matches: async guess => same(guess, env) };
  return null;
}

async function required() {
  const p = await current();
  if (!p) throw Object.assign(new Error('Reel needs MOVIES_PASSWORD on the server.'), { status: 503 });
  return p;
}

function sign(p, value) {
  const key = createHash('sha256').update(`reel-session:${p.secret}`).digest();
  return createHmac('sha256', key).update(value).digest('base64url');
}

export async function hasPassword() {
  return !!(await current());
}

export async function passwordMatches(guess) {
  return (await required()).matches(guess || '');
}

export async function setPassword(next) {
  const salt = randomBytes(16).toString('hex');
  await (await db()).collection('settings').updateOne({ _id: 'password' },
    { $set: { salt, hash: await derive(next, salt), changedAt: new Date() } }, { upsert: true });
}

export async function sessionCookie(req) {
  const p = await required();
  const expires = Date.now() + DAYS * 864e5;
  const value = `${expires}.${sign(p, String(expires))}`;
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure ? '; Secure' : ''}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function signedIn(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [expires, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  const p = await current();
  return !!p && same(sig, sign(p, expires));
}
