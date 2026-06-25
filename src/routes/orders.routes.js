const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { optionalAuth, authenticate, requireAdmin } = require("../middleware/auth");
const { userClient } = require("../utils/userClient");
const { supabaseAdmin } = require("../config/supabase");
const { orderSchema } = require("../validators/schemas");

const router = express.Router();
const DELIVERY = { inside_dhaka: 80, outside_dhaka: 120 };

// POST /api/orders  (guest or logged-in) — totals computed SERVER-SIDE (never trust client)
router.post("/", optionalAuth, validate(orderSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const subtotal = b.items.reduce((s, it) => s + Number(it.price) * it.qty, 0);
  const delivery = DELIVERY[b.delivery_zone];

  // (Optional) re-validate coupon here and compute discount server-side
  const discount = 0; // see coupons route for the validation helper to plug in
  const total = subtotal + delivery - discount;

  

  const client = userClient(req.accessToken); // acts as the user (or guest) so RLS applies
  console.log("ORDER AUTH →", req.user ? `user ${req.user.id}` : "GUEST", "| token?", !!req.accessToken);  // <-- ADD THIS
  const { data, error } = await client.rpc("place_order", {
    p_customer_name: b.customer_name,
    p_customer_phone: b.customer_phone,
    p_address: b.address,
    p_city: b.city || null,
    p_delivery_zone: b.delivery_zone,
    p_subtotal: subtotal,
    p_delivery_charge: delivery,
    p_discount: discount,
    p_total: total,
    p_coupon_code: b.coupon_code || null,
    p_payment_method: b.payment_method,
    p_note: b.note || null,
    p_items: b.items,
  });
  if (error) throw error;
  res.status(201).json({ order_code: data, subtotal, delivery, discount, total });
}));

// GET /api/orders/track/:code  (public) — single order via secure RPC
router.get("/track/:code", asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.rpc("get_order_by_code", { p_code: req.params.code });
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Order not found" });
  res.json(data);
}));

// GET /api/orders  (admin) — list with items
router.get("/", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  res.json({ items: data });
}));

// PATCH /api/orders/:id/status  (admin)
router.patch("/:id/status", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const allowed = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });
  const { data, error } = await supabaseAdmin.from("orders").update({ status: req.body.status }).eq("id", req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

module.exports = router;
