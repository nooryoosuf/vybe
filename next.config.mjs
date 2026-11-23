/** @type {import('next').NextConfig} */
const isCfBuild = process.env.CF_BUILD === '1';

const nextConfig = {
  reactStrictMode: true,
  ...(isCfBuild ? { output: 'export' } : {}),
  images: {
    ...(isCfBuild ? { unoptimized: true } : {}),
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'media.tenor.com',
      },
    ],
  },
};

export default nextConfig;
