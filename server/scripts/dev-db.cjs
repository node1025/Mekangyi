const path = require('node:path');
const maria = require('../src/config/maria');

function devTarget(env = process.env) {
  if (env.NODE_ENV === 'production') throw new Error('운영 환경에서는 개발용 초기화를 실행할 수 없습니다.');
  const uri = env.DEV_MARIADB_URI?.trim();
  if (!uri) throw new Error('server/.env의 DEV_MARIADB_URI에 개발용 DB 주소를 설정해주세요.');
  let url;
  try { url = new URL(uri); } catch { throw new Error('개발 DB 주소 형식이 올바르지 않습니다.'); }
  const database = url.pathname.slice(1);
  if (!['mariadb:'].includes(url.protocol) || !/^[a-zA-Z0-9_-]+_dev$/.test(database) || /_test_dev$/.test(database)) {
    throw new Error('개발 DB 이름은 _dev로 끝나야 합니다. 예: bukang_shop_dev (_test_dev는 통합 테스트 전용)');
  }
  return { uri, database };
}

async function runDev(work) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
    const { uri, database } = devTarget();
    await maria.connect(uri);
    console.log(`개발 DB: ${database}`);
    await work();
  } catch (error) {
    const guidance = /^(운영 환경|server\/\.env|개발 DB|접속한 DB|이미 존재)/.test(error.message);
    console.error(guidance ? error.message : `실행 실패 (${error.code || error.name}). MariaDB 연결·입력값을 확인해주세요.`);
    process.exitCode = 1;
  } finally {
    await maria.disconnect();
  }
}

module.exports = { devTarget, runDev };
