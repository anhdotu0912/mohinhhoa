import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  allowedDevOrigins: ["127.0.0.1", "[::1]"],
  experimental: { cpus: 1 },
  /* config options here */
};

export default nextConfig;
