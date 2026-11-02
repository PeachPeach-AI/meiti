/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    if (isServer) {
      config.externals = [...(config.externals || []), 'sql.js'];
    }
    return config;
  },
  serverExternalPackages: ['sql.js'],
}

module.exports = nextConfig
