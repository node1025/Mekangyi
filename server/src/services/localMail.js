const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const directory = path.join(__dirname, '../../.local-mail');
function createStore(dir = directory) {
  const list = () => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(name => /^[a-f0-9-]{36}\.json$/.test(name)).flatMap(name => {
      try { const mail = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); return Date.parse(mail.expiresAt) > Date.now() ? [mail] : []; } catch { return []; }
    }).sort((a,b) => b.receivedAt.localeCompare(a.receivedAt));
  };
  return {
    list,
    save(message) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      // Local reset mail expires alongside the one-time reset token.
      const mail = { ...message, id: randomUUID(), receivedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+15*60000).toISOString() };
      fs.writeFileSync(path.join(dir, mail.id+'.json'), JSON.stringify(mail), { flag:'wx', mode:0o600 });
      const keep = new Set(list().slice(0,50).map(m=>m.id+'.json'));
      for (const name of fs.readdirSync(dir)) if (/^[a-f0-9-]{36}\.json$/.test(name) && !keep.has(name)) fs.unlinkSync(path.join(dir,name));
      return mail;
    }
  };
}
module.exports = { createStore, directory };
