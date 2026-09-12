import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  // Expo authenticates its own clients. Only these retained compatibility
  // endpoints call Next's auth(); the import worker uses machine authentication.
  matcher: ["/api/recipes/:path*"],
};
