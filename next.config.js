/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // TODO: Re-enable once remaining ~150 TypeScript errors are fixed
    ignoreBuildErrors: true,
  },
  eslint: {
    // TODO: Re-enable once TypeScript errors are resolved
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        dns: false,
        stream: false,
        path: false,
        zlib: false,
        http: false,
        https: false,
        child_process: false,
        cluster: false,
        os: false,
        url: false,
        querystring: false,
        util: false,
        buffer: false,
        events: false,
      };
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      ioredis: false,
    };

    return config;
  },
};

module.exports = nextConfig;
