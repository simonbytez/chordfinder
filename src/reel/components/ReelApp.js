// Reel: a private movie library. Signs you in, then shows the library.
import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import Library from './Library';
import Logo from './Logo';
import s from '../../../styles/Reel.module.css';

const SETUP = [
  ['password', 'MOVIES_PASSWORD', 'the password for getting in'],
  ['database', 'MONGODB_URI', 'where the library is kept'],
  ['bunny', 'BUNNY_STREAM_LIBRARY_ID + BUNNY_STREAM_API_KEY', 'where the movies are stored and streamed'],
  ['tmdb', 'TMDB_API_KEY', 'posters, cast and details (optional)'],
  ['claude', 'ANTHROPIC_API_KEY', 'smart shelves (optional)'],
];

function Login({ setup, onSignedIn }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const missing = SETUP.filter(([k]) => !setup[k] && ['password', 'database'].includes(k));

  async function submit(e) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/login', { method: 'POST', body: { password } });
      onSignedIn();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return <div className={s.login}>
    <div className={s.loginGlow} />
    <form className={s.loginCard} onSubmit={submit}>
      <Logo className={s.loginLogo} />
      <p>Movie night is this way.</p>
      {missing.length > 0
        ? <div className={s.setupList}>
          <strong>Almost ready. Add these in Vercel:</strong>
          {missing.map(([k, name, what]) => <div key={k}><code>{name}</code><span>{what}</span></div>)}
        </div>
        : <>
          <input type="password" autoFocus placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} aria-label="Password" />
          {error && <div className={s.loginError} role="alert">{error}</div>}
          <button type="submit" className={s.btnPlay} disabled={busy || !password}>
            {busy ? <LoaderCircle size={20} className={s.spin} /> : <>Enter <ArrowRight size={20} /></>}
          </button>
        </>}
    </form>
  </div>;
}

export default function ReelApp() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    api('/session').then(setSession).catch(() => setSession({ signedIn: false, setup: {} }));
  }, []);

  if (!session) return <div className={s.splash}><Logo /></div>;
  if (!session.signedIn) return <Login setup={session.setup} onSignedIn={() => setSession(x => ({ ...x, signedIn: true }))} />;
  return <Library setup={session.setup} setupList={SETUP} onSignedOut={() => setSession(x => ({ ...x, signedIn: false }))} />;
}
