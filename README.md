# RAINZLIFESTYLE API (Express + Supabase)

Backend that serves the React storefront and admin panel. Talks to Supabase
Postgres (RLS) and Storage. Optimizes images (WebP) before storing.

## Setup
Requires Node.js 20 or newer (the payment integration uses built-in fetch).
1. `cp .env.example .env` and fill in values from Supabase → Project Settings → API:
   - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
   - CORS_ORIGIN = http://localhost:3000 (your CRA dev URL)
2. `npm install`
3. `npm run dev`  → http://localhost:5000  (health: /health)

## Security model
- Service-role key lives ONLY here (never in the browser).
- Every request's Supabase JWT is verified locally (middleware/auth.js).
- Admin routes check `profiles.role = 'admin'`.
- helmet, CORS allow-list, rate limiting, zod validation, multer file limits.
- Order totals + coupon discounts are computed server-side (client values ignored).

## SSLCommerz hosted checkout

1. Apply `supabase/migrations/202609250001_add_sslcommerz_payments.sql` in the Supabase SQL editor before deploying this code.
2. Fill in the new variables in `Backend/.env` (and your backend hosting environment):
   - `SSLCOMMERZ_STORE_ID`: your sandbox store ID.
   - `SSLCOMMERZ_STORE_PASSWORD`: your sandbox store password; keep it on the backend only.
   - `SSLCOMMERZ_IS_LIVE=false`: change to `true` only with live credentials.
   - `PAYMENT_BACKEND_URL`: public backend origin, without `/api` or a trailing slash.
   - `PAYMENT_FRONTEND_URL`: frontend origin, without a trailing slash.
3. For local testing, expose port 5000 through a public HTTPS tunnel and use that origin as `PAYMENT_BACKEND_URL`. SSLCommerz cannot send IPN notifications to localhost. `PAYMENT_FRONTEND_URL=http://localhost:3000` can be used for the browser return during local testing.
4. Keep the frontend's existing `REACT_APP_API_BASE_URL` pointed at the backend `/api`; add its origin to `CORS_ORIGIN` as usual. Restart the backend after configuring environment variables.
5. Select online payment at checkout and supply an email address and postal code. Test success, cancellation and failure with sandbox credentials before enabling live payments.

The integration uses the [official SSLCommerz hosted API](https://developer.sslcommerz.com/doc/v4/) through Node's built-in fetch; no SDK installation is needed.

- `POST /api/payments/init`: accepts the checkout order payload, `customer_email`, and `customer_postcode`; computes catalog/sale/coupon prices and returns `gateway_url`, `order_code`, and `payment_token`. An initiation failure returns `payment_url` for the saved order's failure page. Never automatically repeat this request after a timeout: first check for an existing order.
- `POST /api/payments/success/:token`, `/fail/:token`, `/cancel/:token`, `/ipn/:token`: callback URLs supplied automatically to SSLCommerz. They accept gateway form POSTs without a customer login. Successful payments are verified against the validation API, including transaction ID, BDT currency, amount and risk level.
- `GET /api/payments/status/:token`: returns only order code, total and payment status. The 64-character receipt token is generated on the server.
- Frontend result pages: `/payment/success` and `/payment/failed`. Both check server payment state; opening a success URL cannot manufacture a successful payment.

Online orders reserve stock and consume a coupon through the existing order flow before redirecting. Failed, abandoned, or uncertain payments remain pending and retain that reservation; staff should reconcile them with SSLCommerz and cancel unpaid orders using the existing admin controls to restore stock. There is no automatic expiry or second-charge retry. Do not delete an online order while a gateway payment could still be in progress. Verified payments for already-cancelled orders and gateway risk flags require manual review. Review does not automatically fulfill or refund an order.

`payment_status` is separate from fulfillment `status`. The admin order list shows Paid, Needs review, or Unpaid / unconfirmed. Online orders cannot enter Processing, Shipped, or Delivered until payment is verified. Repeated success/IPN callbacks do not deduct stock again or downgrade a paid order. Failure/cancellation callback fields alone never change persisted payment state.

Run the isolated payment checks with `node --test src/utils/sslcommerz.test.js src/routes/payments.routes.test.js`. These mock the gateway/database; a real sandbox transaction and migration execution are still required for deployment validation.

## Images (fast loading)
- Uploads kept in memory → sharp resizes (max 1200px) → WebP @ ~78% quality.
- Stored with `Cache-Control: 1 year immutable` so the CDN serves them fast.

## Endpoints (so far)
- Auth:      POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- Products:  GET /api/products, GET /api/products/:slug,
             POST/PUT/DELETE (admin, multipart `images[]`)
- Categories:GET /api/categories, admin POST/PUT/DELETE
- Orders:    POST /api/orders (guest/user), GET /api/orders/track/:code,
             GET /api/orders (admin), PATCH /api/orders/:id/status (admin)
- Coupons:   POST /api/coupons/validate, admin CRUD
- Settings:  GET /api/settings, PUT /api/settings (admin)

## Next to add (same patterns)
sale, customers, stores, banners/collections, product reviews, newsletter.
# Size chart measurement units

Size chart measurement cells are stored and returned in centimeters. The size
column is a label and is never converted. Create/update requests accept only
`unit: "cm"` (omitting the unit also means cm); API responses include `unit: "cm"`.

The existing eight templates were converted from inches using a factor of 2.54,
rounded to two decimal places. Original records are saved in
`supabase/backups/size-charts-before-cm.json`. The one-time migration is
`node scripts/convert-size-charts-to-cm.js --apply`; running it again with that
snapshot skips already converted records and refuses changed measurements.
Keep the snapshot to prevent accidental repeat conversion. New templates must
be entered directly in cm and must not be included in the inch migration.
