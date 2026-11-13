import Link from "next/link";

export default function LightNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-5xl">🔦</p>
      <h1 className="mt-4 text-xl font-semibold">That light isn&apos;t in the catalog</h1>
      <p className="mt-2 text-sm text-muted-foreground">It may have been merged or removed by an admin.</p>
      <Link href="/flashlights?mode=vault" className="mt-6 inline-block text-sm text-amber underline underline-offset-4">
        Browse the Deep Vault
      </Link>
    </div>
  );
}
