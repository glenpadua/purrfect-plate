/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/_expo/:path*", destination: "/universal/_expo/:path*" },
        { source: "/assets/:path*", destination: "/universal/assets/:path*" },
        ...["/", "/add", "/edit", "/pantry", "/account", "/imports", "/import/:path*", "/recipe/:path*", "/callback", "/hosted-auth-callback"].map(source => ({
          source,
          destination: "/universal/index.html",
        })),
      ],
    }
  },
}

export default nextConfig
