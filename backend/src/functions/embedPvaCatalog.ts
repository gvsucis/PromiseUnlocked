import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { embedAndBrief } from "@/services/pvaCatalogService";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Embeds a new catalog PVA + distills its brief on create.
// retry off (rare, billed work); recover failures via the admin re-embed endpoint.
export const embedPvaCatalog = onDocumentCreated(
  {
    document: "pva_catalog/{pvaId}",
    secrets: [geminiApiKey],
    memory: "1GiB",
    timeoutSeconds: 300,
    concurrency: 1,
    maxInstances: 10,
    retry: false,
  },
  async (event) => {
    if (!event.data) return;
    await embedAndBrief(event.params.pvaId, `pva:${event.params.pvaId}`);
  }
);
