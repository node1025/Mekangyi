const http = require('node:http');
const { createStore } = require('../server/src/services/localMail');
const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createMailbox(store = createStore()) {
  return http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    const hosts = ['127.0.0.1','localhost'].map(host=>host+':'+req.socket.localPort);
    if (!hosts.includes(req.headers.host) || (req.headers.origin && req.headers.origin!=='http://'+req.headers.host)) {res.writeHead(403);return res.end('Forbidden')}
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);return res.end('Method not allowed')}
    const mails = store.list();
    let body;
    if (req.url === '/') {
      body = '<h1>부캉이 로컬 테스트 메일함</h1><p>실제 이메일로 전송하지 않은 재설정 메일입니다. 링크는 15분 동안 한 번만 사용할 수 있습니다.</p><a href="/">새로고침</a>'+ (mails.length?mails.map(mail=>`<article><h2>${escape(mail.subject)}</h2><p>받는 사람: ${escape(mail.to)}</p><p>${escape(mail.receivedAt)}</p><a href="/messages/${mail.id}">메일 열기 →</a></article>`).join(''):'<article>아직 도착한 메일이 없습니다. 쇼핑몰에서 재설정 링크를 요청해주세요.</article>');
    } else {
      const match = /^\/messages\/([a-f0-9-]{36})$/.exec(req.url);
      const mail = match && mails.find(m=>m.id===match[1]);
      if (!mail) {res.writeHead(404);return res.end('Mail not found or expired')}
      body = `<a href="/">← 메일 목록</a><h1>${escape(mail.subject)}</h1><p>받는 사람: ${escape(mail.to)}</p><p>아래 버튼에서 새 비밀번호를 설정해주세요.</p><a class="primary" href="${escape(mail.link)}" target="_blank" rel="noopener noreferrer">비밀번호 재설정하기 →</a>`;
    }
    res.setHeader('Content-Type','text/html; charset=utf-8');res.writeHead(200);
    res.end(req.method==='HEAD'?'':`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>부캉이 로컬 메일함</title><style>body{font:16px/1.8 Arial,'Malgun Gothic',sans-serif;color:#122551;background:#f4f7fd;max-width:900px;margin:40px auto;padding:24px}h1{font-size:27px}h2{font-size:19px}article{padding:24px;background:white;border:1px solid #d7e2f2;border-radius:12px;margin-top:20px}a{color:#122551}.primary{display:inline-block;background:#122551;color:white;padding:12px 24px;border-radius:7px;text-decoration:none}p{overflow-wrap:anywhere}</style><body>${body}</body></html>`);
  });
}
module.exports = { createMailbox };
