import { createRouter, createWebHistory } from 'vue-router';
import axios from 'axios';
import Login from '../views/Login.vue';
import AdminPage from '../views/AdminPage.vue';
import { adminPaths } from '../config/adminRoutes';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', redirect: adminPaths.login },
    { path: adminPaths.login, name: 'AdminLogin', component: Login },
    { path: adminPaths.gate, redirect: adminPaths.console },
    {
      path: adminPaths.console,
      name: 'AdminConsole',
      component: AdminPage,
      meta: { requiresAdmin: true },
    },
    { path: '/:pathMatch(.*)*', redirect: adminPaths.login },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.requiresAdmin) {
    try {
      await axios.get('/api/admin/session');
    } catch {
      return adminPaths.login;
    }
  }
});

export default router;
