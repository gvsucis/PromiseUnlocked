import { db } from "@/services/firestore";
import { splitFullName } from "@/utils/nameSplit";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 100;

// One-time backfill: split fullName into first/last. Idempotent; `--dry-run` previews counts.
async function splitNamesMigration() {
  const startAt = process.argv.find((a) => a.startsWith("--start-at="))?.split("=")[1];
  const snapshot = await db.collection("participants").get();

  const docs = snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      const hasBoth = Boolean(data.firstName) && Boolean(data.lastName);
      const hasFull = Boolean(data.fullName);
      return !hasBoth && hasFull;
    })
    .filter((doc) => !startAt || doc.id >= startAt);

  console.log(
    `[split-names] Found ${docs.length} participants missing firstName/lastName${
      DRY_RUN ? " (DRY RUN — no writes)" : ""
    }.`
  );

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      const fullName = doc.data().fullName as string | undefined;
      const { firstName, lastName } = splitFullName(fullName ?? "");
      if (!firstName && !lastName) {
        skipped++;
        continue;
      }
      if (DRY_RUN) {
        console.log(`  ${doc.id}: "${fullName}" -> "${firstName}" + "${lastName}"`);
      } else {
        batch.update(doc.ref, { firstName, lastName });
      }
      updated++;
    }
    if (!DRY_RUN) await batch.commit();
    console.log(`[split-names] Processed ${i + chunk.length}/${docs.length}...`);
  }

  console.log(`[split-names] Done. Updated: ${updated}, Skipped: ${skipped}.`);
}

splitNamesMigration().catch((err) => {
  console.error("[split-names] Failed:", err);
  process.exit(1);
});
