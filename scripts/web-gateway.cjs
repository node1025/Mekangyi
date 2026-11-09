const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { BlockList, isIP } = require('node:net');
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon' };
function allowedNetworks(spec='127.0.0.1/32,::1/128') {
  const list = new BlockList();
  for (const value of spec.split(',').map(v=>v.trim()).filter(Boolean)) {
    const [ip,bits]=value.split('/');const version=isIP(ip);
    if (!version) throw Error('Invalid admin allowlist');
    const family=version===4?'ipv4':'ipv6';
    if(bits!==undefined)list.addSubnet(ip,Number(bits),family);else list.addAddress(ip,family);
  }
  return address=>{const ip=String(address||'').replace(/^::ffff:/,'');return list.check(ip,isIP(ip)===6?'ipv6':'ipv4')};
}
function publicApiAllowed(method, pathname) {
  const p=pathname.toLowerCase().replace(/\/{2,}/g,'/');
  if (/^\/api\/admin(?:\/|$)/.test(p)||/^\/api\/(orders|review)\/admin(?:\/|$)/.test(p))return false;
  if (/^\/api\/products(?:\/|$)/.test(p))return ['GET','HEAD'].includes(method);
  if (/^\/api\/orders(?:\/|$)/.test(p))return ['GET','HEAD','POST'].includes(method);
  if (/^\/api\/review(?:\/|$)/.test(p))return ['GET','HEAD','POST'].includes(method);
  return /^\/api\/(auth|cart|wishlist|board)(?:\/|$)/.test(p);
}
function gateway({root,uploads,admin=false,apiPort=5002,allowlist}) {
  const allowed=allowedNetworks(allowlist);
  return http.createServer((req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    if(admin){res.setHeader('Cache-Control','no-store');if(!allowed(req.socket.remoteAddress)){res.writeHead(403);return res.end('Forbidden')}}
    let pathname;
    try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname)}catch{res.writeHead(400);return res.end('Bad request')}
    if(pathname.includes('\\')||pathname.includes('\0')){res.writeHead(400);return res.end('Bad request')}
    if(pathname.startsWith('/api/')){
      if(!admin&&!publicApiAllowed(req.method,pathname)){res.writeHead(403);return res.end('Forbidden')}
      const headers={...req.headers,'x-forwarded-for':req.socket.remoteAddress,'x-forwarded-proto':'http','x-forwarded-host':req.headers.host};
      delete headers['x-admin-gateway'];
      const upstream=http.request({host:'127.0.0.1',port:apiPort,path:req.url,method:req.method,headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});
      upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('API unavailable')});req.pipe(upstream);return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Method not allowed')}
    if(!admin&&/^\/admin(?:\/|$)/.test(pathname)){res.writeHead(404);return res.end('Not found')}
    const image=pathname.startsWith('/uploads/');const base=path.resolve(image?uploads:root);
    let file=path.resolve(base,'.'+(image?pathname.slice('/uploads'.length):pathname));
    if(!file.startsWith(base+path.sep)&&file!==base){res.writeHead(403);return res.end('Forbidden')}
    if(pathname.split('/').some(p=>p.startsWith('.')&&p.length>1)){res.writeHead(404);return res.end('Not found')}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){
      if(image||path.extname(pathname)){res.writeHead(404);return res.end('Not found')}
      file=path.join(base,'index.html');
    }
    if(!fs.existsSync(file)){res.writeHead(503);return res.end('Run npm run build first')}
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    const stat=fs.statSync(file);
    if(image&&process.env.LOCAL_STACK_IMAGE_NO_CACHE==='true'){
      res.setHeader('Cache-Control','no-store, must-revalidate');
      res.setHeader('ETag',`W/"${stat.mtimeMs}-${stat.size}"`);
      res.setHeader('Last-Modified',stat.mtime.toUTCString());
    }else{
      const imageCache=image?'public, max-age=3600':'public, max-age=3600';
      if(!admin)res.setHeader('Cache-Control',image?imageCache:path.extname(file)==='.html'?'no-cache':'public, max-age=3600');
    }
    res.setHeader('Content-Length',stat.size);res.writeHead(200);
    if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
  });
}
module.exports={gateway,allowedNetworks,publicApiAllowed};
