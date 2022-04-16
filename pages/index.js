import Link from 'next/link';

export default function Home() {
  return <h1 className="title">
  <Link href="/guitar">
    <a>guitar</a>
  </Link>
  <br />
  <Link href="/salsa">
    <a>salsa</a>
  </Link>
  <br />
  <Link href="/harp">
    <a>harp</a>
  </Link>
</h1>
}
