#!/usr/bin/env node
// Usage: node scripts/generate-download-qr.mjs [--build] [--page] [--platform android|ios] [--profile <name>]

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const OWNER = "gvsu-blue-nucleus";
const SLUG = "promise-unlock-app";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "dist");
const PNG_PATH = resolve(OUT_DIR, "download-qr.png");
const HTML_PATH = resolve(OUT_DIR, "download-qr.html");

function getFlag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const platform = getFlag("platform", "android");
const profile = getFlag("profile", "preview");
const doBuild = hasFlag("build");
const doPage = hasFlag("page");

function eas(args) {
  return execFileSync("npx", ["eas", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
}

function startBuild() {
  console.log(`\n🏗  Starting EAS build (platform=${platform}, profile=${profile})...\n`);
  execFileSync("npx", ["eas", "build", "--platform", platform, "--profile", profile], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

function latestBuild() {
  const raw = eas([
    "build:list",
    "--platform",
    platform,
    "--profile",
    profile,
    "--status",
    "finished",
    "--limit",
    "1",
    "--json",
    "--non-interactive",
  ]);
  const builds = JSON.parse(raw);
  if (!Array.isArray(builds) || builds.length === 0) {
    throw new Error(
      `No finished ${platform} builds found for profile "${profile}". Run with --build first.`
    );
  }
  return builds[0];
}

async function main() {
  if (doBuild) startBuild();

  const build = latestBuild();
  const installUrl = `https://expo.dev/accounts/${OWNER}/projects/${SLUG}/builds/${build.id}`;
  const artifact = build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl ?? null;

  const terminal = await QRCode.toString(installUrl, { type: "terminal", small: true });
  console.log(`\n📲 Scan to install (${platform}, ${profile}):\n`);
  console.log(terminal);
  console.log(`Install page: ${installUrl}`);
  if (artifact) console.log(`Direct download: ${artifact}`);

  mkdirSync(OUT_DIR, { recursive: true });
  await QRCode.toFile(PNG_PATH, installUrl, { width: 512, margin: 2 });
  console.log(`\n🖼  PNG written: ${PNG_PATH}`);

  if (doPage) {
    const dataUri = await QRCode.toDataURL(installUrl, { width: 512, margin: 2 });
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Install PromiseUnlocked</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; text-align: center; padding: 2rem; }
  img { width: 320px; max-width: 90vw; }
  code { background: #f2f2f2; padding: .15rem .35rem; border-radius: 4px; }
  a { word-break: break-all; }
</style>
</head>
<body>
  <h1>Install PromiseUnlocked</h1>
  <p>Scan the QR code with your ${platform} device, or open the link below.</p>
  <img src="${dataUri}" alt="Install QR code" />
  <p><a href="${installUrl}">${installUrl}</a></p>
  <p><small>Build <code>${build.id}</code> · profile <code>${profile}</code> · ${build.appVersion ?? ""}</small></p>
</body>
</html>`;
    writeFileSync(HTML_PATH, html);
    console.log(`📄 HTML page written: ${HTML_PATH}`);
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err.message ?? err}`);
  process.exit(1);
});
