import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

const DynamicGame = dynamic(() => import('../../src/echoesunseen/components/Game'), { ssr: false });

export default function GamePage() {
  const router = useRouter();
  const { gameId } = router.query;

  if (!gameId) return <div>Loading...</div>;

  return <DynamicGame gameId={gameId} />;
}
