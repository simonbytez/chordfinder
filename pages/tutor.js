import Head from 'next/head';
import dynamic from 'next/dynamic';

// Everything is saved in the browser (IndexedDB), so the app only renders there
const TutorApp = dynamic(() => import('../src/tutor/components/TutorApp'), { ssr: false });

export default function Tutor() {
  return <>
    <Head>
      <title>Tabletop Tutor</title>
      <meta name="description" content="Drop in a board game rulebook and Claude builds you a tutorial with lessons, quizzes and a cheat sheet." />
      <meta name="theme-color" content="#0d0f1c" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:ital,wght@0,400..700;1,400..600&display=swap" />
    </Head>
    <style jsx global>{`
      html, body { background: #0d0f1c; }
    `}</style>
    <TutorApp />
  </>;
}
