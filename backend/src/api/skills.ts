import { Router } from "express";
import { STAMP_TAXONOMY, DERIVED_STAMPS, VALID_CATEGORIES } from "@/services/stampTaxonomy";

const router = Router();

router.get("/taxonomy", (_req, res) => {
  res.json({
    categories: VALID_CATEGORIES,
    stamps: DERIVED_STAMPS,
    taxonomy: STAMP_TAXONOMY,
  });
});

export default router;
