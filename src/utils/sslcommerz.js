const crypto = require("node:crypto");

function config() {
  const { SSLCOMMERZ_STORE_ID: storeId, SSLCOMMERZ_STORE_PASSWORD: password,
    PAYMENT_BACKEND_URL: backend, PAYMENT_FRONTEND_URL: frontend } = process.env;
  if (!storeId || !password || !backend || !frontend) {
    throw Object.assign(new Error("Online payments are not configured yet."), { status: 503 });
  }
  for (const value of [backend, frontend]) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash) {
      throw new Error("Invalid payment URL configuration");
    }
  }
  return { storeId, password, backend: backend.replace(/\/$/, ""), frontend: frontend.replace(/\/$/, ""),
    gateway: process.env.SSLCOMMERZ_IS_LIVE === "true" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com" };
}

async function request(path, params, method = "GET") {
  const c = config();
  const body = new URLSearchParams({ store_id: c.storeId, store_passwd: c.password, ...params });
  const response = await fetch(`${c.gateway}${path}${method === "GET" ? `?${body}` : ""}`, {
    method, ...(method === "POST" ? { body } : {}), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Payment gateway is unavailable");
  return response.json();
}

function matchesPayment(result, order) {
  return ["VALID", "VALIDATED"].includes(result.status)
    && result.tran_id === order.payment_transaction_id
    && result.currency === "BDT"
    && Number.isFinite(Number(result.amount))
    && Math.round(Number(result.amount) * 100) === Math.round(Number(order.total) * 100);
}

async function initiate(order, email, postcode) {
  if (typeof postcode !== "string" || !postcode.trim()) {
    throw Object.assign(new Error("Postal code is required for online payment"), { status: 400 });
  }
  const c = config();
  const callback = (kind) => `${c.backend}/api/payments/${kind}/${order.payment_token}`;
  const data = await request("/gwprocess/v4/api.php", {
    total_amount: Number(order.total).toFixed(2), currency: "BDT", tran_id: order.payment_transaction_id,
    success_url: callback("success"), fail_url: callback("fail"), cancel_url: callback("cancel"), ipn_url: callback("ipn"),
    cus_name: order.customer_name, cus_email: email, cus_phone: order.customer_phone,
    cus_add1: order.address, cus_city: order.city || "Dhaka", cus_postcode: postcode.trim(), cus_country: "Bangladesh",
    shipping_method: "Courier", ship_name: order.customer_name, ship_add1: order.address,
    ship_city: order.city || "Dhaka", ship_postcode: postcode.trim(), ship_country: "Bangladesh",
    product_name: `Order ${order.order_code}`, product_category: "Clothing", product_profile: "general", emi_option: "0",
  }, "POST");
  if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
    const error = new Error("Could not start the payment session");
    error.gatewayReason = String(data.failedreason || "Gateway rejected the session")
      .replaceAll(c.password, "[redacted]").replaceAll(c.storeId, "[store]").slice(0, 500);
    throw error;
  }
  const url = new URL(data.GatewayPageURL);
  if (url.protocol !== "https:" || !(url.hostname === "sslcommerz.com" || url.hostname.endsWith(".sslcommerz.com"))) {
    throw new Error("Invalid gateway redirect");
  }
  return url.href;
}

module.exports = { config, initiate, matchesPayment,
  newTransactionId: () => `RZ${crypto.randomBytes(14).toString("hex")}`,
  validatePayment: (valId) => request("/validator/api/validationserverAPI.php", { val_id: valId, format: "json", v: "1" }),
};
