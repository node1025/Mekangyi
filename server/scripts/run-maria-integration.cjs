require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { spawnSync } = require('node:child_process');
const target = require('../test/mariaTestTarget.cjs')();
const url = new URL(target);
if (!url.pathname.endsWith('_test_demo')) throw new Error('통합 테스트 DB 이름은 _test_demo로 끝나야 합니다. 테스트 중 데이터가 삭제됩니다.');
for (const name of ['MARIADB_URI', 'DEMO_MARIADB_URI']) {
  if (process.env[name] && new URL(process.env[name]).pathname === url.pathname) throw new Error('테스트 DB는 실행 DB와 별도로 지정해주세요.');
}
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1'], { cwd: require('node:path').join(__dirname, '..'), stdio: 'inherit', env: { ...process.env, RUN_INVENTORY_INTEGRATION: '1', RUN_DEMO_INTEGRATION: '1', RUN_MARIA_HTTP: '1' } });
process.exitCode = result.status ?? 1;
