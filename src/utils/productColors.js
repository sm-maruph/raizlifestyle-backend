// Use the same positional association as the storefront gallery.
function colorImage(product, color) {
  const images = [...(product.product_images || [])].sort((a, b) => a.position - b.position);
  const index = (product.colors || []).findIndex((entry) => entry.name === color);
  return (index >= 0 && images[index]?.url) || product.image || images[0]?.url || null;
}
module.exports = { colorImage };
