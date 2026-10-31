// Reel is private: one password (MOVIES_PASSWORD) unlocks it, and a signed,
// HttpOnly cookie keeps you signed in for 60 days. Changing the password signs
// everyone out, because the cookie's signature is keyed on it.
import { createHash, createHmac, timingSafeEqual } from 'crypto';

const COOKIE = 'reel_session';
const DAYS = 60;

function key() {
  if (!process.env.MOVIES_PASSWORD) throw Object.assign(new Error('Reel needs MOVIES_PASSWORD on the server.'), { status: 503 });
  return createHash('sha256').update(`reel-session:${process.env.MOVIES_PASSWORD}`).digest();
}

function sign(value) {
  return createHmac('sha256', key()).update(value).digest('base64url');
}

function same(a, b) {
  const h = s => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(a), h(b));
}

export function passwordMatches(guess) {
  key();
  return same(guess || '', process.env.MOVIES_PASSWORD);
}

export function sessionCookie(req) {
  const expires = Date.now() + DAYS * 864e5;
  const value = `${expires}.${sign(String(expires))}`;
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure ? '; Secure' : ''}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function signedIn(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [expires, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return same(sig, sign(expires));
}
