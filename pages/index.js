import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Frets, Congas, Counts, Keys, Steps, Board, Temple, Notebook } from '../src/home/components/Covers';
import styles from '../styles/Home.module.css';

// Everything on the site, as cards. Add a product here to give it a card.
const PRODUCTS = [
  { href: '/guitar', name: 'Chord Finder', kind: 'music', tag: 'Music', color: '#f28c28', Cover: Frets,
    blurb: 'Find any chord or scale on the guitar neck.' },
  { href: '/salsa', name: 'Salsa Band', kind: 'music', tag: 'Music', color: '#e5484d', Cover: Congas,
    blurb: 'A salsa band to play along with. Tap instruments in and out and set the tempo.' },
  { href: '/voice', name: 'Vocal Warm-ups', kind: 'music', tag: 'Music', color: '#12a594', Cover: Keys,
    blurb: 'Tap a phrase on the piano. It plays it back, climbing a half step at a time and back down.' },
  { href: '/harp', name: 'Salsa Moves', kind: 'music', tag: 'Music', color: '#e5488a', Cover: Counts,
    blurb: 'Shuffles up a partner pattern, count by count, from the holds, turns and positions you pick.' },
  { href: '/drumtoolz', name: 'Drum Toolz', kind: 'music', tag: 'Music', color: '#3e63dd', Cover: Steps,
    blurb: 'Write, save, share and generate rhythm patterns to practice.' },
  { href: '/realmsend', name: "Realm's End", kind: 'games', tag: 'Game', color: '#1f3b33', Cover: Board,
    blurb: "Two-player strategy where you can't see the other side. Scout, plant listening devices and jammers, and hunt for their flag." },
  { href: '/ammon', name: 'Republic of Rome', kind: 'family', tag: 'For Ammon', color: '#5b3a8c', Cover: Temple,
    blurb: 'An interactive guide to the Republic of Rome board game.' },
  { href: '/dad', name: 'Sermon Notebook', kind: 'family', tag: 'For Dad', color: '#8a5a3b', Cover: Notebook,
    blurb: "Search Tim Keller's sermons, tie them to lessons and keep notes." },
];

const KINDS = [['all', 'All'], ['music', 'Music'], ['games', 'Games'], ['family', 'Family']];
const KIND_KEY = 'boomcat:kind';

export default function Home() {
  const [kind, setKind] = useState('all');

  // Remember the filter for this tab, so coming back from a product keeps it
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KIND_KEY);
      if (KINDS.some(([k]) => k === saved)) setKind(saved);
    } catch {}
  }, []);

  function choose(k) {
    setKind(k);
    try { sessionStorage.setItem(KIND_KEY, k); } catch {}
  }

  const shown = PRODUCTS.filter(p => kind === 'all' || p.kind === kind);

  return <div className={styles.page}>
    <Head>
      <meta name="description" content="Music tools, games, and a few things made for family." />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap" />
    </Head>

    <header className={styles.header}>
      <h1 className={styles.wordmark}>
        <svg className={styles.cat} viewBox="0 0 28 26" aria-hidden="true">
          <path d="M3.5 11 L5.5 2.5 L11 8 H17 L22.5 2.5 L24.5 11 Q26.5 23.5 14 24.5 Q1.5 23.5 3.5 11 Z" />
          <circle cx="10" cy="15" r="1.8" />
          <circle cx="18" cy="15" r="1.8" />
        </svg>
        boomcat
      </h1>
      <p className={styles.tagline}>Music tools, games, and a few things made for family.</p>
    </header>

    <div className={styles.filters} role="group" aria-label="Show">
      {KINDS.map(([k, label]) => <button key={k} type="button" className={styles.chip} aria-pressed={kind === k} onClick={() => choose(k)}>
        {label}
        <span className={styles.count}>{k === 'all' ? PRODUCTS.length : PRODUCTS.filter(p => p.kind === k).length}</span>
      </button>)}
    </div>

    <ul className={styles.grid}>
      {shown.map(({ href, name, tag, color, Cover, blurb }, i) =>
        // Keyed on the filter too, so the cards deal in again when it changes
        <li key={kind + href} className={styles.item} style={{ animationDelay: `${i * 40}ms` }}>
          <Link href={href}>
            <a className={styles.card}>
              <div className={styles.cover} style={{ background: color }}><Cover /></div>
              <div className={styles.body}>
                <h2 className={styles.name}>{name}</h2>
                <p className={styles.blurb}>{blurb}</p>
                <div className={styles.foot}>
                  <span className={styles.tag}>{tag}</span>
                  <svg className={styles.arrow} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
                </div>
              </div>
            </a>
          </Link>
        </li>)}
    </ul>
  </div>;
}
