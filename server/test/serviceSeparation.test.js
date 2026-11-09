const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {gateway,allowedNetworks,publicApiAllowed}=require('../../scripts/web-gateway.cjs');
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const request=(port,url,options={})=>new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:url,...options},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}))});req.on('error',reject);req.end()});
test('public gateway denies administrative APIs and write methods, including normalized paths',()=>{
 for(const [method,url] of [['GET','/api/admin/session'],['POST','/api/admin/session'],['GET','/api/orders/admin/all'],['GET','/api/review/admin/all'],['PATCH','/api/products/abc'],['POST','/api/products/complex'],['DELETE','/api/orders/abc'],['DELETE','/api/review/abc'],['POST','/api//admin/session']])assert.equal(publicApiAllowed(method,url),false,method+' '+url);
 assert.ok(publicApiAllowed('GET','/api/products'));
 assert.ok(publicApiAllowed('POST','/api/orders/prepare'));
 assert.ok(publicApiAllowed('PATCH','/api/cart'));
 assert.ok(publicApiAllowed('POST','/api/wishlist/toggle'));
 assert.ok(publicApiAllowed('GET','/api/wishlist/status/507f1f77bcf86cd799439011'));
});
test('administrator network matching supports explicit IPv4/IPv6 CIDRs and defaults to loopback',()=>{
 const local=allowedNetworks();assert.ok(local('127.0.0.1'));assert.ok(local('::ffff:127.0.0.1'));assert.equal(local('127.0.0.2'),false);
 const vpn=allowedNetworks('10.8.0.0/24,2001:db8::/64');assert.ok(vpn('10.8.0.22'));assert.ok(vpn('2001:db8::1'));assert.equal(vpn('10.9.0.1'),false);
 assert.equal(allowedNetworks('')('127.0.0.1'),false);
});
test('HTTP gateways serve static images without API and enforce administrator boundary',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'goods-gateway-'));
 fs.mkdirSync(path.join(dir,'uploads'));fs.writeFileSync(path.join(dir,'index.html'),'<h1>static storefront</h1>');fs.writeFileSync(path.join(dir,'uploads','test.png'),'fixture');
 const upstream=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({forwarded:req.headers['x-forwarded-for']}))});
 const apiPort=await listen(upstream);
 const shop=gateway({root:dir,uploads:path.join(dir,'uploads'),apiPort});
 const admin=gateway({root:dir,uploads:path.join(dir,'uploads'),apiPort,admin:true});
 const shopPort=await listen(shop),adminPort=await listen(admin);
 t.after(async()=>{await Promise.all([shop,admin,upstream].map(s=>new Promise(r=>s.close(r))));fs.rmSync(dir,{recursive:true,force:true})});
 assert.equal((await request(shopPort,'/')).status,200);
 assert.equal((await request(shopPort,'/uploads/test.png')).body,'fixture');
 assert.equal((await request(shopPort,'/uploads/missing.png')).status,404);
 assert.equal((await request(shopPort,'/admin')).status,404);
 assert.equal((await request(shopPort,'/api/admin/session')).status,403);
 assert.equal((await request(shopPort,'/api/products/abc',{method:'PATCH'})).status,403);
 assert.equal((await request(shopPort,'/api/%61dmin/session')).status,403);
 assert.equal((await request(adminPort,'/login')).status,200);
 assert.equal((await request(adminPort,'/login',{localAddress:'127.0.0.2',headers:{'X-Forwarded-For':'127.0.0.1'}})).status,403);
 assert.equal((await request(adminPort,'/api/admin/session',{localAddress:'127.0.0.2'})).status,403);
 const response=await request(shopPort,'/api/products',{headers:{'X-Forwarded-For':'8.8.8.8'}});
 assert.equal(JSON.parse(response.body).forwarded,'127.0.0.1');
});
test('backend administrative sessions accept only configured direct gateway peers',()=>{
 const previous=process.env.ADMIN_GATEWAY_PEERS;
 process.env.ADMIN_GATEWAY_PEERS='172.30.0.11';
 try{const {allowed}=require('../src/middleware/adminNetwork');assert.ok(allowed({socket:{remoteAddress:'::ffff:172.30.0.11'}}));assert.equal(allowed({socket:{remoteAddress:'172.30.0.10'},headers:{'x-forwarded-for':'172.30.0.11'}}),false)}finally{if(previous===undefined)delete process.env.ADMIN_GATEWAY_PEERS;else process.env.ADMIN_GATEWAY_PEERS=previous}
});
