const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { supabaseAdmin } = require("../config/supabase");
const { config, validatePayment, matchesPayment } = require("../utils/sslcommerz");
const router = express.Router();
const { optionalAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { orderSchema } = require("../validators/schemas");
router.post("/init", optionalAuth, (req, _res, next) => {
  req.body.payment_method = "sslcommerz";
  next();
}, validate(orderSchema), require("./orders.routes").createOrder);
const validToken = (token) => /^[0-9a-f]{64}$/.test(token || "");

async function findOrder(token) {
  if (!validToken(token)) return null;
  const { data, error } = await supabaseAdmin.from("orders").select("*").eq("payment_token", token).maybeSingle();
  if (error) throw error;
  return data;
}

// An unguessable receipt token grants access only to payment status, never customer details.
router.get("/status/:token", asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  const order = await findOrder(req.params.token);
  if (!order) return res.status(404).json({ error: "Payment not found" });
  res.json({ order_code: order.order_code, total: order.total, payment_status: order.payment_status });
}));

router.post("/:outcome/:token", asyncHandler(async (req, res) => {
  const { outcome, token } = req.params;
  if (!["success", "fail", "cancel", "ipn"].includes(outcome)) return res.sendStatus(404);
  const order = await findOrder(token);
  if (!order) return res.status(404).json({ error: "Payment not found" });
  let status = order.payment_status;
  let reason = outcome === "cancel" ? "cancelled" : "failed";
  try {
    // Callback fields are untrusted. Only the validation API can confirm receipt of money.
    if (typeof req.body.val_id === "string" && req.body.val_id.length <= 200) {
      const result = await validatePayment(req.body.val_id);
      if (!matchesPayment(result, order)) {
        if (outcome === "ipn") return res.status(400).json({ error: "Payment validation mismatch" });
        reason = "unverified";
      } else {
        const next = String(result.risk_level) === "0" && order.status !== "Cancelled" ? "paid" : "review";
        const { error } = await supabaseAdmin.from("orders").update({
          payment_status: next, payment_validation_id: result.val_id || req.body.val_id,
          payment_bank_transaction_id: result.bank_tran_id || null, paid_at: new Date().toISOString(),
        }).eq("id", order.id).in("payment_status", ["pending", "failed"]);
        if (error) throw error;
        status = (await findOrder(token)).payment_status;
      }
    } else if (outcome === "ipn" && ["VALID", "VALIDATED"].includes(req.body.status)) {
      return res.status(400).json({ error: "Missing validation ID" });
    }
  } catch (error) {
    // A non-2xx IPN response allows the provider to retry after transient failures.
    if (outcome === "ipn") throw error;
    reason = "unverified";
  }
  if (outcome === "ipn") return res.json({ received: true });
  const page = status === "paid" ? "success" : "failed";
  if (status === "review") reason = "review";
  const url = new URL(`${config().frontend}/payment/${page}`);
  url.searchParams.set("token", token);
  if (page === "failed") url.searchParams.set("reason", reason);
  res.set("Cache-Control", "no-store").redirect(303, url.href);
}));

module.exports = router;
