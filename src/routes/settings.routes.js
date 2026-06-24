const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { supabaseAdmin } = require("../config/supabase");

const router = express.Router();

// GET /api/settings  (public) — storefront reads delivery charges, social, etc.
router.get("/", asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("store_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  res.set("Cache-Control", "public, max-age=120");
  res.json(data);
}));

// PUT /api/settings  (admin)
router.put("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from("store_settings").update(req.body).eq("id", 1).select().single();
  if (error) throw error;
  res.json(data);
}));

module.exports = router;
