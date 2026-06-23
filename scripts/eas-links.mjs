#!/usr/bin/env node
import qrcode from "qrcode-terminal";

const channel = process.argv[2] ?? "preview";
const projectId = "62341192-c723-4426-aeb9-7f9186e2accb";

const runtimeVersion = "1.0.0";

const url = `https://qr.expo.dev/eas-update?projectId=${projectId}&runtimeVersion=${runtimeVersion}&channel=${channel}`;

console.log(`\n📱 Scan to open preview:\n`);
qrcode.generate(url, { small: true });
console.log(`\n${url}\n`);
