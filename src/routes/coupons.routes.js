const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { supabaseAdmin } = require("../config/supabase");
const { couponValidateSchema } = require("../validators/schemas");

const router = express.Router();

// POST /api/coupons/validate  (public) — secure server-side check + discount calc
router.post("/validate", validate(couponValidateSchema), asyncHandler(async (req, res) => {
  const code = req.body.code.trim().toUpperCase();
  const subtotal = req.body.subtotal;
  const { data: c } = await supabaseAdmin.from("coupons").select("*").eq("code", code).single();

  if (!c || !c.enabled) return res.status(404).json({ valid: false, error: "Invalid coupon" });
  const today = new Date().toISOString().slice(0, 10);
  if (c.start_date && today < c.start_date) return res.status(400).json({ valid: false, error: "Coupon not active yet" });
  if (c.expiry_date && today > c.expiry_date) return res.status(400).json({ valid: false, error: "Coupon expired" });
  if (c.usage_limit && c.used_count >= c.usage_limit) return res.status(400).json({ valid: false, error: "Coupon usage limit reached" });
  if (c.min_order && subtotal < c.min_order) return res.status(400).json({ valid: false, error: `Minimum order ৳${c.min_order}` });

  let discount = 0, freeShipping = false;
  if (c.type === "percent") {
    discount = Math.round((subtotal * c.value) / 100);
    if (c.max_discount) discount = Math.min(discount, c.max_discount);
  } else if (c.type === "fixed") {
    discount = Math.min(c.value, subtotal);
  } else if (c.type === "shipping") {
    freeShipping = true;
  }
  res.json({ valid: true, code, type: c.type, discount, freeShipping });
}));

// Admin CRUD
router.get("/", authenticate, requireAdmin, asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  res.json({ items: data });
}));
router.post("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from("coupons").insert(req.body).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));
router.put("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from("coupons").update(req.body).eq("id", req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));
router.delete("/:id", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.from("coupons").delete().eq("id", req.params.id);
  if (error) throw error;
  res.json({ success: true });
}));

module.exports = router;
