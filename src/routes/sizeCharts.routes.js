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
  res.json((data || []).map((chart) => ({ ...chart, unit: "cm" })));
}));

router.get("/", asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("size_chart_templates")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  res.json((data || []).map((chart) => ({ ...chart, unit: "cm" })));
}));

router.post("/", authenticate, requireAdmin, validate(sizeChartCreate), asyncHandler(async (req, res) => {
  const { unit, ...chart } = req.body; // Measurements are stored directly in cm.
  const { data, error } = await supabaseAdmin
    .from("size_chart_templates")
    .insert(chart)
    .select()
    .single();
  if (error) throw error;
  res.status(201).json({ ...data, unit: "cm" });
}));

router.put("/:id", authenticate, requireAdmin, validate(sizeChartUpdate), asyncHandler(async (req, res) => {
  const { unit, ...chart } = req.body;
  const { data, error } = await supabaseAdmin
    .from("size_chart_templates")
    .update({ ...chart, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) throw error;
  res.json({ ...data, unit: "cm" });
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
