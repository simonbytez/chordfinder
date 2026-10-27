module.exports = {
  productionBrowserSourceMaps: true,
  async rewrites() {
    return [
      // The Republic of Rome tutorial is a self-contained page in public/ammon.
      { source: '/ammon/republic-of-rome', destination: '/ammon/republic-of-rome.html' },
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