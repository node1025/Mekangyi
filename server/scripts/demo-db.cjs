const path = require('node:path');
const maria = require('../src/config/maria');

function demoTarget(env = process.env) {
  if (env.NODE_ENV === 'production') throw new Error('운영 환경에서는 데모 초기화를 실행할 수 없습니다.');
  const uri = env.DEMO_MARIADB_URI?.trim();
  if (!uri) throw new Error('server/.env의 DEMO_MARIADB_URI에 별도 테스트 DB 주소를 설정해주세요.');
  let url;
  try { url = new URL(uri); } catch { throw new Error('데모 DB 주소 형식이 올바르지 않습니다.'); }
  const database = url.pathname.slice(1);
  if (!['mariadb:'].includes(url.protocol) || !/^[a-zA-Z0-9_-]+_demo$/.test(database)) {
    throw new Error('데모 DB 이름은 _demo로 끝나야 합니다. 예: bukang_shop_demo');
  }
  return { uri, database };
}

async function runDemo(work) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
    const { uri, database } = demoTarget();
    await maria.connect(uri);
    console.log(`테스트 DB: ${database}`);
    await work();
  } catch (error) {
    // Driver errors can contain hostnames or credentials. Only show our own guidance.
    const guidance = /^(운영 환경|server\/\.env|데모 DB|접속한 DB|이미 존재)/.test(error.message);
    console.error(guidance ? error.message : `실행 실패 (${error.code || error.name}). MariaDB 연결·입력값을 확인해주세요.`);
    process.exitCode = 1;
  } finally {
    await maria.disconnect();
  }
}

module.exports = { demoTarget, runDemo };
