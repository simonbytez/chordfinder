const LUMENPULSE_SERVER_FILES = [
  // SQL migrations are read from disk at runtime (auto-migrate on first request).
  './src/lumenpulse/drizzle/**/*',
  // Embedded PGlite loads its WASM and data bundle from its own package folder.
  './node_modules/@electric-sql/pglite/dist/*.{wasm,data}',
];

module.exports = {
  productionBrowserSourceMaps: true,
  // Don't let `next dev` write an AGENTS.md into the repo.
  agentRules: false,

  // These only affect the App Router (app/), where LumenPulse lives at /flashlights.
  // Everything in pages/ works exactly as before.
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ['@electric-sql/pglite'],
  outputFileTracingIncludes: {
    '/flashlights': LUMENPULSE_SERVER_FILES,
    '/flashlights/**': LUMENPULSE_SERVER_FILES,
    '/api/flashlights/**': LUMENPULSE_SERVER_FILES,
  },
  turbopack: {
    rules: {
      // Tailwind runs on LumenPulse's one stylesheet and nothing else, so the
      // CSS modules used by the other apps are left alone.
      '*.tailwind.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },

  async headers() {
    return [
      {
        // LumenPulse's service worker controls /flashlights and nothing above it.
        source: '/flashlights/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/flashlights' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/flashlights/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },
  async rewrites() {
    return [
      // Self-contained pages in public/, served without the .html.
      { source: '/republic-of-rome', destination: '/republic-of-rome.html' },
      { source: '/tim-keller', destination: '/tim-keller.html' },
      { source: '/salsa-bones', destination: '/salsa-bones.html' },
    ];
  },
  async redirects() {
    return [
      // Old addresses from when these pages lived under /ammon and /dad. The full
      // paths moved for good; the bare /ammon and /dad stay temporary so those
      // names are free to use again.
      { source: '/ammon/republic-of-rome', destination: '/republic-of-rome', permanent: true },
      { source: '/dad/tim-keller', destination: '/tim-keller', permanent: true },
      { source: '/ammon', destination: '/republic-of-rome', permanent: false },
      { source: '/dad', destination: '/tim-keller', permanent: false },
    ];
  },
};
