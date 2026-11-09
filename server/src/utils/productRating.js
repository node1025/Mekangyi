const Review = require('../models/review');
const Product = require('../models/product/product');

async function syncProductRating(productId, options = {}) {
  const id = String(productId);
  const reviews = await Review.find({ productId: id }).select('rating').lean();
  const count = reviews.length;
  const avg = count === 0
    ? 0
    : Math.round((reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / count) * 10) / 10;

  const updateOpts = {};
  if (options.session) updateOpts.session = options.session;

  await Product.updateOne(
    { _id: id },
    { $set: { rating: { avg, count } } },
    updateOpts
  );

  return { avg, count };
}

async function syncAllProductRatings() {
  const products = await Product.find({ isDeleted: false }).select('_id').lean();
  let updated = 0;
  for (const product of products) {
    await syncProductRating(product._id);
    updated += 1;
  }
  return updated;
}

module.exports = { syncProductRating, syncAllProductRatings };
