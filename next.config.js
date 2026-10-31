module.exports = {
  productionBrowserSourceMaps: true,
  async rewrites() {
    return [
      // Self-contained pages in public/, served without the .html.
      { source: '/republic-of-rome', destination: '/republic-of-rome.html' },
      { source: '/tim-keller', destination: '/tim-keller.html' },
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
  webpack(config, { dev, isServer }) {
    // For instance, if you want a particular devtool in dev mode only:
    if (!isServer && dev) {
      config.devtool = 'eval-source-map';
    }
    return config;
  },
};
