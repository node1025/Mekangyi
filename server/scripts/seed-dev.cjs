const maria = require('../src/config/maria');
const fs = require('node:fs');
const path = require('node:path');
const Product = require('../src/models/product/product');
const Variant = require('../src/models/product/productvariant');
const Inventory = require('../src/models/product/inventory');
const catalog = require('../data/dev-products.json');
const { runDev } = require('./dev-db.cjs');

async function seedProducts() {
  for (const item of catalog) {
    for (const image of [item.images.thumbnail, ...item.images.gallery]) {
      if (!fs.existsSync(path.join(__dirname, '..', image))) throw new Error('개발 DB 상품 이미지 파일이 누락되었습니다.');
    }
  }
  await Promise.all([Product, Variant, Inventory].map(model => model.init()));
  const session = await maria.startSession();
  let summary;
  try {
    await session.withTransaction(async () => {
      summary = { products: 0, variants: 0, inventories: 0, skippedProducts: 0 };
      for (const { product, variants, images, sizes, stockQuantity } of catalog) {
        if (await Product.exists({ productCode: product.productCode }).session(session)) {
          summary.skippedProducts++;
          continue;
        }
        const [saved] = await Product.create([product], { session });
        summary.products++;
        for (const variant of variants) {
          const [option] = await Variant.create([{ ...variant, productId: saved._id, images: variant.images || images }], { session });
          await Inventory.insertMany(sizes.map(size => ({
            variantId: option._id, sku: `${variant.variantCode}-${size}`, size: String(size), stockQuantity
          })), { session });
          summary.variants++;
          summary.inventories += sizes.length;
        }
      }
    });
    return summary;
  } finally { await session.endSession(); }
}

if (require.main === module) {
  runDev(async () => {
    const result = await seedProducts();
    console.log(`추가: 상품 ${result.products}개 / 색상 ${result.variants}개 / 사이즈별 재고 ${result.inventories}개`);
    console.log(`기존 상품 ${result.skippedProducts}개는 가격·옵션·재고를 변경하지 않고 건너뛰었습니다.`);
  });
}

module.exports = { seedProducts };
