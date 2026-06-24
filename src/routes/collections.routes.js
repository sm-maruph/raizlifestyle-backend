const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { supabaseAdmin } = require("../config/supabase");

const router = express.Router();

router.get("/", asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("collections").select("*").eq("is_active", true).order("position");
  if (error) throw error;
  res.set("Cache-Control", "public, max-age=120");
  res.json({ items: data });
}));

router.post("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from("collections").insert(req.body).select().single();
  if (error) throw error; res.status(201).json(data);
}));
router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from("collections").update(req.body).eq("id", req.params.id).select().single();
  if (error) throw error; res.json(data);
}));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from("collections").delete().eq("id", req.params.id);
  if (error) throw error; res.json({ success: true });
}));

module.exports = router;
