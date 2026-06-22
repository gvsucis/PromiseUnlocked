#!/usr/bin/env node
/**
 * Deploys Firestore indexes (and optionally rules) to Firebase.
 *
 * Usage:
 *   npm run deploy:firestore            — indexes only
 *   npm run deploy:firestore -- --rules — indexes + rules
 *   npm run deploy:firestore -- --all   — indexes + rules
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PROJECT = "promise-unlocked-for-sure";

const args = process.argv.slice(2);
const includeRules = args.includes("--rules") || args.includes("--all");

// Verify required config files exist before attempting deploy.
const required = ["firebase.json", "firestore.indexes.json"];
if (includeRules) required.push("firestore.rules");

for (const file of required) {
  if (!existsSync(resolve(ROOT, file))) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
}

const targets = ["firestore:indexes"];
if (includeRules) targets.push("firestore:rules");

const cmd = `firebase deploy --only ${targets.join(",")} --project ${PROJECT}`;

console.log(`\nDeploying to project: ${PROJECT}`);
console.log(`Targets: ${targets.join(", ")}`);
console.log(`Command: ${cmd}\n`);

try {
  execSync(cmd, { stdio: "inherit", cwd: ROOT });
  console.log("\nDeploy complete.");
} catch {
  console.error("\nDeploy failed.");
  process.exit(1);
}
