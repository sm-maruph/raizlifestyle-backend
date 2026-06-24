const express = require("express");
const router = express.Router();

router.use("/products", require("./products.routes"));
router.use("/categories", require("./categories.routes"));
router.use("/orders", require("./orders.routes"));
router.use("/coupons", require("./coupons.routes"));
router.use("/auth", require("./auth.routes"));
router.use("/settings", require("./settings.routes"));
router.use("/cart", require("./cart.routes"));
router.use("/wishlist", require("./wishlist.routes"));
router.use("/banners", require("./banners.routes"));
router.use("/collections", require("./collections.routes"));
router.use("/stores", require("./stores.routes"));

module.exports = router;
