const mariadb = require('mariadb');
const fs = require('fs');
let pool;
const registry = new Map();
function sslOptions() {
  const ca = process.env.MARIADB_SSL_CA;
  if (ca) return { ssl: { ca: fs.readFileSync(ca) } };
  if (process.env.MARIADB_SSL === 'true') return { ssl: { rejectUnauthorized: false } };
  return {};
}
function options(uri = process.env.MARIADB_URI) {
  if (!uri) throw new Error('MARIADB_URI를 server/.env에 설정해주세요.');
  const url = new URL(uri);
  if (url.protocol !== 'mariadb:' || !/^[A-Za-z0-9_]+$/.test(url.pathname.slice(1))) throw new Error('Invalid MariaDB URI');
  return { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectionLimit: 8,
    timezone: 'Z', bigIntAsNumber: true, insertIdAsNumber: true, ...sslOptions() };
}
async function connect(uri) {
  pool = mariadb.createPool(options(uri));
  await pool.query('SELECT 1');
  for (const model of registry.values()) await model.init();
  if (registry.has('User')) {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS shippingAddress JSON NULL');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS adminReauthPassword VARCHAR(255) NULL');
  }
  // Expired reset tokens are already rejected by the controller; prune them on startup too.
  if (registry.has('PasswordReset')) await pool.query('DELETE FROM passwordresets WHERE expiresAt <= UTC_TIMESTAMP(3)');
  if (registry.has('AdminSession')) await pool.query('DELETE FROM adminsessions WHERE expiresAt <= UTC_TIMESTAMP(3)');
}
function database() { if (!pool) throw new Error('MariaDB is not connected'); return pool; }
async function startSession() {
  const connection = await database().getConnection();
  let active = false;
  return {
    connection,
    async startTransaction() { await connection.beginTransaction(); active = true; },
    async commitTransaction() { await connection.commit(); active = false; },
    async abortTransaction() { if (active) await connection.rollback(); active = false; },
    async endSession() { if (active) await connection.rollback(); active = false; connection.release(); },
    async withTransaction(work) { await this.startTransaction(); try { const result = await work(this); await this.commitTransaction(); return result; } catch (error) { await this.abortTransaction(); throw error; } }
  };
}
async function transaction(work) {
  const session = await startSession();
  try { return await session.withTransaction(() => work(session)); } finally { await session.endSession(); }
}
async function disconnect() { if (pool) { await pool.end(); pool = null; } }
module.exports = { options, connect, database, startSession, transaction, disconnect, registry };
