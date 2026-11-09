const maria = require('../src/config/maria');
const Product = require('../src/models/product/product');
const Variant = require('../src/models/product/productvariant');
const Inventory = require('../src/models/product/inventory');
const catalog = require('../data/demo-products.json');
const { runDemo } = require('./demo-db.cjs');
const codes = new Set(['bukangi_tshirt', 'bukangi_plush_doll', 'bukangi_doll_keyring', 'bukangi_mousepad']);

// Add requested colors without replacing product IDs, prices or consumed stock.
async function updateGoodsOptions() {
  return maria.transaction(async session => {
    const summary = { products: 0, createdVariants: 0, createdInventories: 0 };
    for (const item of catalog.filter(row => codes.has(row.product.productCode))) {
      const product = await Product.findOne({ productCode: item.product.productCode }).session(session);
      if (!product) throw new Error('먼저 seed:demo로 상품을 준비해주세요.');
      for (const definition of item.variants) {
        let variant = await Variant.findOne({ productId: product._id, variantCode: definition.variantCode }).session(session);
        if (variant) {
          variant.color = definition.color;
          variant.images = definition.images || item.images;
          await variant.save({ session });
        } else {
          [variant] = await Variant.create([{ ...definition, productId: product._id, images: definition.images || item.images }], { session });
          summary.createdVariants++;
        }
        for (const size of item.sizes) {
          const existing = await Inventory.findOne({ variantId: variant._id, size }).session(session);
          if (!existing) {
            await Inventory.create({ variantId: variant._id, sku: `${definition.variantCode}-${size}`, size, stockQuantity: item.stockQuantity }, { session });
            summary.createdInventories++;
          }
        }
      }
      summary.products++;
    }
    return summary;
  });
}
if (require.main === module) runDemo(async () => console.log(await updateGoodsOptions()));
module.exports = { updateGoodsOptions };
