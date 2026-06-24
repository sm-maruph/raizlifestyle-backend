const express = require("express");
const router = express.Router();

router.use("/products", require("./products.routes"));
router.use("/categories", require("./categories.routes"));
router.use("/orders", require("./orders.routes"));
router.use("/coupons", require("./coupons.routes"));
router.use("/auth", require("./auth.routes"));
router.use("/settings", require("./settings.routes"));
// Add as you build them: sale, customers, stores, banners, reviews, newsletter...

module.exports = router;
