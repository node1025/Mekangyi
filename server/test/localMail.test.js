const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const localMail=require('../src/services/localMail');const mailer=require('../src/services/resetMailer');
function configure(t){for(const [key,value]of Object.entries({NODE_ENV:'development',RESET_MAIL_MODE:'local',FRONTEND_URL:'http://127.0.0.1:8082'})){const old=process.env[key];process.env[key]=value;t.after(()=>{if(old===undefined)delete process.env[key];else process.env[key]=old})}}
function storeFixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bukangi-local-mail-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,store:localMail.createStore(dir)}}
test('local reset mail is restricted to explicit development and loopback frontend',t=>{
 configure(t);assert.equal(mailer.getSettings().local,true);
 process.env.NODE_ENV='production';assert.throws(()=>mailer.getSettings());
 process.env.NODE_ENV='development';for(const url of ['http://evil.example.com','https://localhost','http://u:p@localhost','http://localhost?token=abc']){process.env.FRONTEND_URL=url;assert.throws(()=>mailer.getSettings())}
});
test('local reset mail is captured without SMTP and keeps tokens in a URL fragment',async t=>{
 configure(t);const {store}=storeFixture(t);
 t.mock.method(localMail,'createStore',()=>store);
 t.mock.method(require('nodemailer'),'createTransport',()=>{throw Error('SMTP must not be called')});
 await mailer.sendResetLink({email:'fixture@example.com',token:'a'.repeat(64)},mailer.getSettings());
 const [mail]=store.list();assert.equal(mail.to,'fixture@example.com');assert.ok(mail.link.endsWith('#token='+'a'.repeat(64)));
});
test('local mailbox excludes expired mail and bounds stored messages',t=>{
 const {dir,store}=storeFixture(t);const first=store.save({to:'a@example.com',subject:'test',link:'http://127.0.0.1/reset-password#token=fixture'});
 fs.writeFileSync(path.join(dir,first.id+'.json'),JSON.stringify({...first,expiresAt:new Date(0).toISOString()}));assert.equal(store.list().length,0);
 for(let i=0;i<55;i++)store.save({to:'fixture@example.com',subject:'test '+i,link:'http://127.0.0.1/reset-password#token=fixture'});
 assert.equal(store.list().length,50);assert.equal(fs.readdirSync(dir).length,50);
});
test('local mailbox rejects foreign Host and Origin and escapes mail content',async t=>{
 const {store}=storeFixture(t);const mail=store.save({to:'fixture@example.com',subject:'<script>alert(1)</script>',link:'http://127.0.0.1/reset-password#token=secret-test'});
 const server=require('../../scripts/local-mailbox.cjs').createMailbox(store);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const port=server.address().port;
 const request=(url,headers={})=>new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,path:url,headers},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}))});req.on('error',reject)});
 assert.equal((await request('/',{Host:'evil.example.com'})).status,403);
 assert.equal((await request('/',{Origin:'https://evil.example.com'})).status,403);
 const list=await request('/');assert.equal(list.status,200);assert.ok(list.body.includes('&lt;script&gt;'));assert.ok(!list.body.includes('secret-test'));
 assert.ok((await request('/messages/'+mail.id)).body.includes('#token=secret-test'));
});
