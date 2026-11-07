require('./models.cjs');
const connect = require('../src/config/db');
const maria = require('../src/config/maria');
connect().then(() => console.log('MariaDB 테이블과 인덱스 준비 완료')).catch(error => {
  console.error('DB 초기화 실패:', error.code || error.name); process.exitCode = 1;
}).finally(() => maria.disconnect());
