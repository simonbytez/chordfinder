// Tabletop Tutor: the library at /tutor, and one game at /tutor?g=<id>.
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Library from './Library';
import GameView from './GameView';
import { Toaster } from './ui';
import { protect } from '../lib/db';
import s from '../../../styles/Tutor.module.css';

export default function TutorApp() {
  const router = useRouter();
  const gameId = typeof router.query.g === 'string' ? router.query.g : null;

  useEffect(() => { protect(); }, []);
  useEffect(() => { if (!gameId) document.title = 'Tabletop Tutor'; }, [gameId]);

  const open = id => router.push(id ? `/tutor?g=${encodeURIComponent(id)}` : '/tutor', undefined, { shallow: true });

  return <div className={s.app}>
    {router.isReady && (gameId
      ? <GameView key={gameId} id={gameId} onBack={() => open(null)} />
      : <Library onOpen={open} />)}
    <Toaster />
  </div>;
}
