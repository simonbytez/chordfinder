module.exports = {
  productionBrowserSourceMaps: true,
  async rewrites() {
    return [
      // The Republic of Rome tutorial is a self-contained page in public/ammon.
      { source: '/ammon/republic-of-rome', destination: '/ammon/republic-of-rome.html' },
      // The Tim Keller sermon notebook is a self-contained page in public/dad.
      { source: '/dad/tim-keller', destination: '/dad/tim-keller.html' },
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