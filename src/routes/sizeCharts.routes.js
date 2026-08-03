const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { supabaseAdmin } = require("../config/supabase");
const { sizeChartCreate, sizeChartUpdate } = require("../validators/schemas");

const router = express.Router();

router.get("/all", authenticate, requireAdmin, asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("size_chart_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  res.json(data || []);
}));

router.get("/", asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("size_chart_templates")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  res.json(data || []);
}));

router.post("/", authenticate, requireAdmin, validate(sizeChartCreate), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("size_chart_templates")
    .insert(req.body)
    .select()
    .single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.put("/:id", authenticate, requireAdmin, validate(sizeChartUpdate), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("size_chart_templates")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) throw error;
  res.json(data);
}));

router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin
    .from("size_chart_templates")
    .delete()
    .eq("id", req.params.id);
  if (error) throw error;
  res.json({ success: true });
}));

module.exports = router;
