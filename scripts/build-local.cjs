'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const env = { ...process.env, LOCAL_PAYMENT_MODE: 'true', VITE_LOCAL_PAYMENT: 'true' };

function npmRun(cwd, script) {
  const result = spawnSync('npm', ['run', script], {
    cwd,
    stdio: 'inherit',
    env,
    shell: true
  });
  if (result.status) process.exit(result.status || 1);
}

npmRun(path.join(root, 'client'), 'build');
npmRun(path.join(root, 'admin'), 'build');
console.log('로컬 스택용 빌드 완료 (LOCAL_PAYMENT_MODE, 관리자 UI 포함)');
