import { discardAllFailedArtifacts } from "@/services/artifactCleanupService";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function main() {
  console.log("Scanning for failed/stale artifacts...");
  const count = await discardAllFailedArtifacts();
  console.log(`Cleaned up ${count} failed/stale artifact(s).`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
