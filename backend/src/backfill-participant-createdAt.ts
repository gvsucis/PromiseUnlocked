import { participantsCollection } from "@/services/firestore";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const snapshot = await participantsCollection.get();
  let patched = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.createdAt) {
      skipped++;
      continue;
    }
    const now = Date.now();
    await doc.ref.update({ createdAt: now });
    console.log(`  Patched ${doc.id} → createdAt: ${now}`);
    patched++;
  }

  console.log(`\nDone. ${patched} patched, ${skipped} already had createdAt.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
