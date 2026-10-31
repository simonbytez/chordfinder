// Reel: Luke's movie library. Checks which services are set up, then shows the library.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Library from './Library';
import Logo from './Logo';
import s from '../../../styles/Reel.module.css';

const SETUP = [
  ['database', 'MONGODB_URI', 'where the library is kept'],
  ['bunny', 'BUNNY_STREAM_LIBRARY_ID + BUNNY_STREAM_API_KEY', 'where the movies are stored and streamed'],
  ['tmdb', 'TMDB_API_KEY', 'posters, cast and details (optional)'],
  ['claude', 'ANTHROPIC_API_KEY', 'smart shelves (optional)'],
];

export default function ReelApp() {
  const [setup, setSetup] = useState(null);
  useEffect(() => {
    api('/session').then(r => setSetup(r.setup)).catch(() => setSetup({}));
  }, []);

  if (!setup) return <div className={s.splash}><Logo /></div>;
  return <Library setup={setup} setupList={SETUP} />;
}
