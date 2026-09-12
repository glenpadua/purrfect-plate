/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/_expo/:path*", destination: "/universal/_expo/:path*" },
        { source: "/assets/:path*", destination: "/universal/assets/:path*" },
      ],
      // Expo owns every screen, including unknown routes. APIs and actual assets
      // resolve first; a missing API or bundle must never receive SPA HTML.
      fallback: [{
        source: "/:path((?!api(?:/|$)|_next(?:/|$)|_expo(?:/|$)|assets(?:/|$)|universal(?:/|$)|__clerk(?:/|$)).*)",
        destination: "/universal/index.html",
      }],
    }
  },
}

export default nextConfig
