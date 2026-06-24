const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { supabaseAdmin } = require("../config/supabase");

const router = express.Router();

// GET /api/categories  (public) — full tree for navbar / product form
router.get("/", asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id,name,slug,accent,category_groups(id,title,position,subcategories(id,name,slug,position))")
    .eq("is_active", true)
    .order("position");
  if (error) throw error;
  res.set("Cache-Control", "public, max-age=300");
  res.json({ items: data });
}));

// Admin create/update/delete category (extend for groups/subcategories similarly)
router.post("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from("categories").insert(req.body).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));
router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from("categories").update(req.body).eq("id", req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from("categories").delete().eq("id", req.params.id);
  if (error) throw error;
  res.json({ success: true });
}));

module.exports = router;
