/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Компактный self-contained вывод для Docker (см. frontend/Dockerfile).
  output: 'standalone',
};

export default nextConfig;

