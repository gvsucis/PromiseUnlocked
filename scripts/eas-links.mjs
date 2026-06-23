#!/usr/bin/env node

const channel = process.argv[2] ?? "preview";
const projectId = "62341192-c723-4426-aeb9-7f9186e2accb";

const runtimeVersion = "1.0.0";

const url = `https://qr.expo.dev/eas-update?projectId=${projectId}&runtimeVersion=${runtimeVersion}&channel=${channel}`;

const expUrl = `exp://u.expo.dev/${projectId}?runtime-version=${runtimeVersion}&channel-name=${channel}`;

console.log(`\n📱 Preview link:\n`);
console.log(`${expUrl}\n`);
