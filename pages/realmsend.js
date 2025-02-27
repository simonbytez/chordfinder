import dynamic from 'next/dynamic';

export default function Home() {
//   const DynamicMain = dynamic(
//     () => import('../src/echoesunseen/components/Game'),
//     { ssr: false }
// )
const DynamicMain = dynamic(() => import('../src/realmsend/components/Game').then(mod => mod.default), { ssr: false });

  return <>
    <DynamicMain />
  </>
}