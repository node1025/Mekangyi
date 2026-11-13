// Authenticate the direct proxy peer, never an untrusted X-Forwarded-For value.
const normalize = ip => String(ip || '').replace(/^::ffff:/, '');
function allowed(req) {
  const configured = process.env.ADMIN_GATEWAY_PEERS;
  if (!configured) return process.env.NODE_ENV !== 'production';
  const peers = configured.split(',').map(value => normalize(value.trim())).filter(Boolean);
  return peers.includes(normalize(req.socket?.remoteAddress));
}
module.exports = { allowed };
