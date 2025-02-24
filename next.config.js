module.exports = {
  productionBrowserSourceMaps: true,
  webpack(config, { dev, isServer }) {
    // For instance, if you want a particular devtool in dev mode only:
    if (!isServer && dev) {
      config.devtool = 'eval-source-map';
    }
    return config;
  },
};