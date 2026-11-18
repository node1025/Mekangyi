const path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
require('../server/node_modules/dotenv').config({path:path.join(root,'server/.env'),quiet:true});
if (!process.env.MARIADB_URI) {
  console.error('실행 실패: MariaDB 연결 설정(MARIADB_URI)이 없습니다.');
  console.error('server/.env.example을 server/.env로 복사한 뒤 DB 연결 정보와 JWT 비밀 키를 설정해주세요.');
  console.error('설정 후 npm run db:init 및 npm run start-all을 실행해주세요.');
  process.exit(1);
}
const {gateway}=require('./web-gateway.cjs');
const {createMailbox}=require('./local-mailbox.cjs');
const mailMode=process.env.RESET_MAIL_MODE||'local';
const mailboxWanted=['1','true','yes'].includes(String(process.env.LOCAL_MAILBOX||'').toLowerCase());
const mailbox=mailMode==='local'&&mailboxWanted?createMailbox():null;
const apiPort=Number(process.env.LOCAL_API_PORT||5002);
const shopPort=Number(process.env.LOCAL_SHOP_PORT||8080),adminPort=Number(process.env.LOCAL_ADMIN_PORT||8081);
const stackEnv={...process.env,NODE_ENV:'development',RESET_MAIL_MODE:mailMode,LOCAL_PAYMENT_MODE:'true',HOST:'127.0.0.1',PORT:String(apiPort),FRONTEND_URL:'http://127.0.0.1:'+shopPort,ADMIN_FRONTEND_URL:'http://localhost:'+adminPort,ADMIN_GATEWAY_PEERS:'127.0.0.1,::1',TRUSTED_PROXIES:'127.0.0.1,::1',SERVE_UPLOADS:'true',IMAGE_STORAGE:'local',LOCAL_STACK_IMAGE_NO_CACHE:'true'};
process.env.LOCAL_STACK_IMAGE_NO_CACHE='true';
const api=spawn(process.execPath,['src/app.js'],{cwd:path.join(root,'server'),stdio:'inherit',windowsHide:true,env:stackEnv});
const uploads=path.join(root,'server/uploads');
const shop=gateway({root:path.join(root,'client/dist'),uploads,apiPort});
const admin=gateway({root:path.join(root,'admin/dist'),uploads,apiPort,admin:true,allowlist:process.env.LOCAL_ADMIN_ALLOWED_CIDRS||'127.0.0.1/32,::1/128'});
function stop(){shop.close();admin.close();mailbox?.close();api.kill()}
for(const server of [shop,admin])server.on('error',error=>{console.error(error.message);stop();process.exitCode=1});
shop.listen(shopPort,'127.0.0.1',()=>console.log('고객몰 http://127.0.0.1:'+shopPort));
admin.listen(adminPort,'127.0.0.1',()=>console.log('관리자 http://localhost:'+adminPort));
mailbox?.on('error',error=>{console.error(error.message);stop();process.exitCode=1});
mailbox?.listen(Number(process.env.LOCAL_MAILBOX_PORT||8025),'127.0.0.1',()=>console.log('로컬 메일함 http://127.0.0.1:'+(process.env.LOCAL_MAILBOX_PORT||8025)));
api.on('error',error=>{console.error('API 서버 실행 실패:',error.code||error.name);stop();process.exitCode=1});
api.on('exit',code=>{shop.close();admin.close();mailbox?.close();if(code){console.error('API 서버가 종료되어 고객몰·관리자 서버도 종료했습니다. 위의 DB 연결 오류를 확인해주세요.');process.exitCode=code}});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
