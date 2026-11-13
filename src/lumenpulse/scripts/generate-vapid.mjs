#!/usr/bin/env node
/**
 * npm run lumenpulse:vapid
 *
 * Generates a VAPID key pair for Web Push and writes it into .env.local
 * (creating the file or replacing existing VAPID lines). Pass --print to only
 * print the keys.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateVAPIDKeys } from "web-push";

const { publicKey, privateKey } = generateVAPIDKeys();
const lines = {
  LUMENPULSE_VAPID_PUBLIC_KEY: publicKey,
  LUMENPULSE_VAPID_PRIVATE_KEY: privateKey,
};

if (process.argv.includes("--print")) {
  for (const [k, v] of Object.entries(lines)) console.log(`${k}=${v}`);
  process.exit(0);
}

const file = ".env.local";
let content = existsSync(file) ? readFileSync(file, "utf8") : "";
for (const [k, v] of Object.entries(lines)) {
  const re = new RegExp(`^${k}=.*$`, "m");
  content = re.test(content) ? content.replace(re, `${k}=${v}`) : `${content.replace(/\n?$/, "\n")}${k}=${v}\n`;
}
if (!/^LUMENPULSE_VAPID_SUBJECT=/m.test(content)) content += "LUMENPULSE_VAPID_SUBJECT=mailto:alerts@example.com\n";
writeFileSync(file, content.replace(/^\n/, ""));

console.log("✓ VAPID keys written to .env.local");
console.log(`  LUMENPULSE_VAPID_PUBLIC_KEY=${publicKey}`);
console.log("  LUMENPULSE_VAPID_PRIVATE_KEY=<hidden>");
console.log("  Set LUMENPULSE_VAPID_SUBJECT to a mailto: or https: contact URL, then restart the dev server.");
