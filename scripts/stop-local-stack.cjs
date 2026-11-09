'use strict';
const { execSync } = require('node:child_process');
const adminPort = process.env.LOCAL_ADMIN_PORT || (process.platform === 'win32' ? '9081' : '8081');
const ports = new Set([
  '8080', '5002', '8025', String(adminPort),
  process.env.LOCAL_SHOP_PORT,
  process.env.LOCAL_API_PORT,
  process.env.LOCAL_MAILBOX_PORT
].filter(Boolean));

if (process.platform !== 'win32') {
  console.log('stop-local은 Windows 기준입니다. 실행 중인 local-stack 터미널에서 Ctrl+C 로 종료해주세요.');
  process.exit(0);
}

const list = [...ports].join(',');
const script = [
  `$p = Get-NetTCPConnection -LocalPort ${list} -State Listen -ErrorAction SilentlyContinue`,
  '| Select-Object -ExpandProperty OwningProcess -Unique;',
  '$killed = 0;',
  'foreach ($id in $p) {',
  '  $proc = Get-Process -Id $id -ErrorAction SilentlyContinue;',
  "  if ($proc -and $proc.ProcessName -eq 'node') { Stop-Process -Id $id -Force; $killed++ }",
  '};',
  'Write-Output ("Stopped " + $killed + " local-stack node process(es).")'
].join(' ');

try {
  console.log(execSync(`powershell -NoProfile -Command ${JSON.stringify(script)}`, { encoding: 'utf8' }).trim());
} catch (e) {
  console.error(e.message || e);
  process.exitCode = 1;
}
