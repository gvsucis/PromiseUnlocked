#!/usr/bin/env node
import qrcode from "qrcode-terminal";

const channel = process.argv[2] ?? "preview";
const projectId = "dab9b9dc-bae0-4d27-8c15-47573a0a1d58";
const runtimeVersion = "1.0.0";

const url = `https://qr.expo.dev/eas-update?projectId=${projectId}&runtimeVersion=${runtimeVersion}&channel=${channel}`;

console.log(`\n📱 Scan to open preview:\n`);
qrcode.generate(url, { small: true });
console.log(`\n${url}\n`);
