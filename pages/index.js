import Link from 'next/link';

export default function Home() {
  const links = ["guitar", "salsa", "harp", "voice", "drumtoolz", "echoesunseen"]
        .map(l => <>
                    <Link href={`/${l}`} key={Math.random().toString}>
                      <a>{l}</a>
                    </Link>
                    <br/>
                  </>)
  return <h1 className="title">
  {links}
</h1>
}
