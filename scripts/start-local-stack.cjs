'use strict';
/** Windows reserves/blocks 8081 on many setups; default admin to 9081 unless overridden. */
if (process.platform === 'win32' && process.env.LOCAL_ADMIN_PORT == null) {
  process.env.LOCAL_ADMIN_PORT = '9081';
}
require('./local-stack.cjs');
