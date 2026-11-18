'use strict';

const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
require('./models.cjs');

const connect = require('../src/config/db');
const maria = require('../src/config/maria');
const { syncAllProductRatings } = require('../src/utils/productRating');

connect()
  .then(async () => {
    const count = await syncAllProductRatings();
    console.log(`상품 평점 동기화 완료: ${count}개 상품`);
  })
  .catch((error) => {
    console.error('평점 동기화 실패:', error.message || error);
    process.exitCode = 1;
  })
  .finally(() => maria.disconnect());
