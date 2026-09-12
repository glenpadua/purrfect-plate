// Use native developer tools directly; Expo's window-activation Apple Events
// helper can fail after opening the app and otherwise take Metro down with it.
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../", import.meta.url));
function simctl(...args) {
  return execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8" });
}
let devices;
try {
  devices = Object.values(
    JSON.parse(simctl("list", "devices", "available", "--json")).devices,
  ).flat();
} catch {
  throw new Error(
    "Complete Xcode first-launch setup and install an iOS Simulator runtime, then retry.",
  );
}
const device =
  devices.find((d) => d.state === "Booted" && d.name.startsWith("iPhone")) ??
  devices.find((d) => d.name === "iPhone 17 Pro") ??
  devices.find((d) => d.name.startsWith("iPhone"));
if (!device)
  throw new Error("Install an iOS Simulator runtime in Xcode first.");
if (device.state !== "Booted") simctl("boot", device.udid);
simctl("bootstatus", device.udid, "-b");
try {
  simctl("get_app_container", device.udid, "host.exp.Exponent", "app");
} catch {
  throw new Error(
    "Install Expo Go once with: pnpm --filter @purrfect-plate/mobile exec expo start --ios --localhost. Then rerun pnpm mobile:ios.",
  );
}
async function ready() {
  try {
    return (
      (await (
        await fetch("http://127.0.0.1:8081/status", {
          signal: AbortSignal.timeout(1000),
        })
      ).text()) === "packager-status:running"
    );
  } catch {
    return false;
  }
}
let metro;
if (!(await ready())) {
  metro = spawn(
    process.execPath,
    [
      "--dns-result-order=ipv4first",
      "./node_modules/expo/bin/cli",
      "start",
      "--localhost",
    ],
    { cwd: directory, stdio: "inherit" },
  );
  metro.on("exit", (code) => process.exit(code ?? 1));
  process.on("SIGINT", () => metro.kill("SIGINT"));
  process.on("SIGTERM", () => metro.kill("SIGTERM"));
  const deadline = Date.now() + 60000;
  while (!(await ready())) {
    if (Date.now() > deadline) {
      metro.kill();
      throw new Error(
        "Metro did not become ready within a minute. Check the output above.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
simctl("openurl", device.udid, "exp://127.0.0.1:8081");
console.log(
  `Purrfect Plate opened on ${device.name} (${device.udid}). Metro: http://127.0.0.1:8081`,
);
