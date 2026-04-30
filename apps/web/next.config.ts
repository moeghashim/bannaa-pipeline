import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = dirname(fileURLToPath(import.meta.url));
const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	skipTrailingSlashRedirect: true,
	typescript: {
		ignoreBuildErrors: isVercelBuild,
	},
	turbopack: {
		root: join(appDir, "../.."),
	},
	async rewrites() {
		return [
			{
				source: "/ingest/static/:path*",
				destination: "https://us-assets.i.posthog.com/static/:path*",
			},
			{
				source: "/ingest/:path*",
				destination: "https://us.i.posthog.com/:path*",
			},
		];
	},
};

export default nextConfig;
