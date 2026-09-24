const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matchesPayment, newTransactionId, config, initiate } = require("./sslcommerz");

test("only matching, validated BDT transactions confirm payment", () => {
  const order = { total: 1280.50, payment_transaction_id: "RZ123" };
  const valid = { status: "VALID", tran_id: "RZ123", currency: "BDT", amount: "1280.50" };
  assert.equal(matchesPayment(valid, order), true);
  assert.equal(matchesPayment({ ...valid, status: "VALIDATED" }, order), true);
  for (const patch of [{ status: "FAILED" }, { tran_id: "OTHER" }, { currency: "USD" }, { amount: "1" }, { amount: "NaN" }]) {
    assert.equal(matchesPayment({ ...valid, ...patch }, order), false);
  }
});

test("transaction IDs are unique and fit the gateway's 30-character limit", () => {
  const ids = new Set(Array.from({ length: 1000 }, newTransactionId));
  assert.equal(ids.size, 1000);
  for (const id of ids) assert.equal(id.length, 30);
});

test("missing credentials disable online payment", () => {
  const previous = process.env.SSLCOMMERZ_STORE_PASSWORD;
  delete process.env.SSLCOMMERZ_STORE_PASSWORD;
  assert.throws(config, { status: 503 });
  if (previous !== undefined) process.env.SSLCOMMERZ_STORE_PASSWORD = previous;
});

test("initiation sends server order data and form callbacks to sandbox", async (t) => {
  const keys = ["SSLCOMMERZ_STORE_ID", "SSLCOMMERZ_STORE_PASSWORD", "SSLCOMMERZ_IS_LIVE", "PAYMENT_BACKEND_URL", "PAYMENT_FRONTEND_URL"];
  const saved = keys.map((key) => process.env[key]);
  const originalFetch = global.fetch;
  t.after(() => {
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
    global.fetch = originalFetch;
  });
  Object.assign(process.env, { SSLCOMMERZ_STORE_ID: "test", SSLCOMMERZ_STORE_PASSWORD: "test-password", SSLCOMMERZ_IS_LIVE: "false", PAYMENT_BACKEND_URL: "https://api.example", PAYMENT_FRONTEND_URL: "https://shop.example" });
  let gatewayUrl = "https://sandbox.sslcommerz.com/EasyCheckOut/test";
  global.fetch = async (url, options) => {
    assert.equal(url, "https://sandbox.sslcommerz.com/gwprocess/v4/api.php");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("total_amount"), "250.50");
    assert.equal(options.body.get("currency"), "BDT");
    assert.equal(options.body.get("ipn_url"), "https://api.example/api/payments/ipn/token");
    assert.equal(options.body.get("cus_email"), "customer@example.com");
    assert.equal(options.body.get("cus_postcode"), "1216");
    assert.equal(options.body.get("ship_postcode"), "1216");
    return { ok: true, json: async () => ({ status: "SUCCESS", GatewayPageURL: gatewayUrl }) };
  };
  const order = { total: 250.5, payment_transaction_id: "TX1", payment_token: "token", order_code: "RZ1", customer_name: "Customer", customer_phone: "01700000000", address: "Dhaka" };
  await assert.rejects(initiate(order, "customer@example.com"), /Postal code is required/);
  assert.equal(await initiate(order, "customer@example.com", "1216"), gatewayUrl);
  gatewayUrl = "https://sslcommerz.com.attacker.example/pay";
  await assert.rejects(initiate(order, "customer@example.com", "1216"), /Invalid gateway redirect/);
});
