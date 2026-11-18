const { test } = require('node:test');
const assert = require('node:assert/strict');
const Review = require('../src/models/review');
const Product = require('../src/models/product/product');
const { syncProductRating } = require('../src/utils/productRating');

test('syncProductRating aggregates review stars into product.rating', async (t) => {
  t.mock.method(Review, 'find', () => ({
    select: () => ({
      lean: async () => [{ rating: 5 }, { rating: 3 }],
    }),
  }));
  let captured;
  t.mock.method(Product, 'updateOne', async (_filter, update) => {
    captured = update;
    return { matchedCount: 1 };
  });

  const result = await syncProductRating('507f1f77bcf86cd799439011');
  assert.equal(result.avg, 4);
  assert.equal(result.count, 2);
  assert.deepEqual(captured.$set.rating, { avg: 4, count: 2 });
});
