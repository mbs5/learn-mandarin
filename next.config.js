/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
      http: false,
      https: false,
      child_process: false,
    };
    return config;
  },
};

module.exports = nextConfig;
