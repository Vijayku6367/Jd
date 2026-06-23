/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    // Instagram API base URLs
    INSTAGRAM_API_BASE: 'https://i.instagram.com/api/v1',
    INSTAGRAM_WEB_BASE: 'https://www.instagram.com',
  },
};
module.exports = nextConfig;

//
