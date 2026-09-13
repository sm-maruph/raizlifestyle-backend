const { test } = require("node:test");
const assert = require("node:assert/strict");
const { colorImage } = require("./productColors");

test("cart and order images follow gallery position even when database rows are unsorted", () => {
  const product = {
    image: "cover.jpg", colors: [{ name: "Blue" }, { name: "White" }],
    product_images: [{ position: 1, url: "white.jpg" }, { position: 0, url: "blue.jpg" }],
  };
  assert.equal(colorImage(product, "Blue"), "blue.jpg");
  assert.equal(colorImage(product, "White"), "white.jpg");
  assert.equal(product.product_images[0].position, 1);
  assert.equal(colorImage(product, null), "cover.jpg");
  assert.equal(colorImage({ ...product, product_images: [] }, "White"), "cover.jpg");
  assert.equal(colorImage({}, "White"), null);
});
