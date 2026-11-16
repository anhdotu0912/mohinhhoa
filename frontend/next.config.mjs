import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel's adapter packages the app; standalone is for the Docker image.
  output: process.env.VERCEL ? undefined : "standalone",
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  allowedDevOrigins: ["127.0.0.1", "[::1]"],
  experimental: { cpus: 1 },
  /* config options here */
};

export default nextConfig;
