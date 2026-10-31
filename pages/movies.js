import Head from 'next/head';
import dynamic from 'next/dynamic';

// The library is private and fetched after sign-in, so it only renders in the browser
const ReelApp = dynamic(() => import('../src/reel/components/ReelApp'), { ssr: false });

export default function Movies() {
  return <>
    <Head>
      <title>Reel</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="theme-color" content="#09090c" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="preconnect" href="https://image.tmdb.org" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@400..800&display=swap" />
    </Head>
    <style jsx global>{`
      html, body { background: #09090c; }
    `}</style>
    <ReelApp />
  </>;
}
