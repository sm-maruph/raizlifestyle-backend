const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const token = "a".repeat(64);
let order;
let validation;
let updates = 0;

const mock = (path, exports) => { require.cache[require.resolve(path)] = { id: require.resolve(path), filename: require.resolve(path), loaded: true, exports }; };
mock("../config/supabase", { supabaseAdmin: { from: () => {
  let patch;
  const query = {
    select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { ...order } }),
    update: (value) => { patch = value; return query; },
    in: async (_key, states) => {
      if (states.includes(order.payment_status)) { Object.assign(order, patch); updates++; }
      return { error: null };
    },
  };
  return query;
} } });
mock("./orders.routes", { createOrder: (_req, res) => res.sendStatus(201) });
const realGateway = require("../utils/sslcommerz");
mock("../utils/sslcommerz", { ...realGateway, config: () => ({ frontend: "https://shop.example" }),
  validatePayment: async () => { if (validation instanceof Error) throw validation; return validation; } });

test("payment callbacks validate, remain idempotent, and handle failures", async (t) => {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use("/api/payments", require("./payments.routes"));
  app.use((err, _req, res, _next) => res.status(500).json({ error: "Temporary error" }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/payments`;
  const reset = () => {
    order = { id: "order-id", order_code: "RZ-ORDER", payment_token: token, total: 100, payment_transaction_id: "TX1", payment_status: "pending", status: "Pending" };
    validation = { status: "VALID", tran_id: "TX1", amount: "100.00", currency: "BDT", risk_level: "0", val_id: "VAL1" };
    updates = 0;
  };
  const post = (outcome, body = { val_id: "VAL1" }) => fetch(`${base}/${outcome}/${token}`, { method: "POST", body: new URLSearchParams(body), redirect: "manual" });

  await t.test("verified success redirects with 303; duplicate IPN writes once", async () => {
    reset();
    const response = await post("success");
    assert.equal(response.status, 303);
    assert.match(response.headers.get("location"), /\/payment\/success/);
    assert.equal(order.payment_status, "paid");
    assert.equal((await post("ipn")).status, 200);
    assert.equal(updates, 1);
    await post("fail", {});
    assert.equal(order.payment_status, "paid");
  });
  await t.test("forged amount does not mark paid", async () => {
    reset(); validation.amount = "1";
    assert.equal((await post("ipn")).status, 400);
    assert.equal(order.payment_status, "pending");
    assert.equal(updates, 0);
  });
  await t.test("failure and cancellation cannot change payment state", async () => {
    reset();
    const response = await post("cancel", {});
    assert.match(response.headers.get("location"), /reason=cancelled/);
    assert.equal(updates, 0);
  });
  await t.test("risky and cancelled orders require review", async () => {
    reset(); validation.risk_level = "1";
    await post("success");
    assert.equal(order.payment_status, "review");
    reset(); order.status = "Cancelled";
    await post("ipn");
    assert.equal(order.payment_status, "review");
  });
  await t.test("temporary validation failure retries IPN and redirects browser safely", async () => {
    reset(); validation = new Error("Timeout");
    assert.equal((await post("ipn")).status, 500);
    assert.match((await post("success")).headers.get("location"), /reason=unverified/);
    assert.equal(order.payment_status, "pending");
  });
  await t.test("status reveals only receipt fields; invalid tokens are rejected", async () => {
    reset();
    const response = await fetch(`${base}/status/${token}`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(Object.keys(await response.json()).sort(), ["order_code", "payment_status", "total"]);
    assert.equal((await fetch(`${base}/status/invalid`)).status, 404);
  });
});
