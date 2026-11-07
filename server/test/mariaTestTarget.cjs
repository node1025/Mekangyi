module.exports = function testTarget() {
  const uri = process.env.TEST_MARIADB_URI;
  if (!uri || !/_(test|demo)$/.test(new URL(uri).pathname)) throw new Error('TEST_MARIADB_URI must point to a dedicated _test or _demo database. Integration tests delete fixture data.');
  return uri;
};
