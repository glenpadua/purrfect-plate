import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

// Next and Expo must use the same deployment. Never read the native app's
// development .env.local while producing the hosted client bundle.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!convexUrl || !clerkKey) throw new Error("The web build requires the public Convex URL and Clerk key.");
if (process.env.VERCEL_ENV === "production" && new URL(convexUrl).hostname !== "spotted-gazelle-950.convex.cloud") {
  throw new Error("Production web builds must target the production recipe library.");
}
const result = spawnSync("pnpm", ["--filter", "@purrfect-plate/mobile", "export:web"], {
  stdio: "inherit",
  env: {
    ...process.env,
    EXPO_NO_DOTENV: "1",
    EXPO_PUBLIC_CONVEX_URL: convexUrl,
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
  },
});
if (result.status !== 0) process.exit(result.status ?? 1);
rmSync("public/universal", { recursive: true, force: true });
cpSync("apps/mobile/dist-web", "public/universal", { recursive: true });
const indexPath = "public/universal/index.html";
writeFileSync(indexPath, readFileSync(indexPath, "utf8").replace("<title>Purrfect Plate Dev</title>", "<title>Purrfect Plate</title>"));
