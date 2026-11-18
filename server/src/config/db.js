const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const maria = require('./maria');
module.exports = async function connectDB() {
  await maria.connect();
  console.log('MariaDB 연결 성공');
};
