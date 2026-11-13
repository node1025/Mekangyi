module.exports = function testTarget() {
  const uri = process.env.TEST_MARIADB_URI;
  if (!uri || !/_test_dev$/.test(new URL(uri).pathname)) {
    throw new Error('TEST_MARIADB_URI must point to a dedicated _test_dev database. Integration tests delete fixture data.');
  }
  return uri;
};
