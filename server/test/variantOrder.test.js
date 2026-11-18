const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sortVariants } = require('../src/utils/variantOrder');
test('requested color ordering chooses white/blue thumbnails independently of SQL row order', () => {
  const shirt = [{ color: '블랙' }, { color: '화이트' }];
  assert.deepEqual(sortVariants('bukangi_tshirt', shirt).map(v => v.color), ['화이트','블랙']);
  assert.deepEqual(shirt.map(v => v.color), ['블랙','화이트']);
  for (const code of ['bukangi_plush_doll','bukangi_doll_keyring']) assert.deepEqual(sortVariants(code, [{color:'핑크'},{color:'블루'}]).map(v=>v.color), ['블루','핑크']);
  assert.deepEqual(sortVariants('custom', shirt), shirt);
});
