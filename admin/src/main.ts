import { createApp } from 'vue';
import axios from 'axios';
import App from './App.vue';
import router from './router';
import { adminPaths, isConsolePath } from './config/adminRoutes';
import {
  bindAdminSessionRoutePath,
  installAdminSessionActionRefresh,
  onAdminApiMutationSucceeded,
} from './utils/adminSessionRefresh';
import { boardHttp } from './utils/boardApi';
import './style.css';

axios.defaults.baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
axios.defaults.withCredentials = true;
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
axios.interceptors.response.use(
  (r) => {
    onAdminApiMutationSucceeded(r);
    return r;
  },
  (error) => {
    if (
      (error.response?.data?.code === 'ADMIN_SESSION_REQUIRED' ||
        error.response?.data?.code === 'ADMIN_REAUTH_REQUIRED') &&
      isConsolePath(router.currentRoute.value.path)
    ) {
      void router.replace(adminPaths.login);
    }
    return Promise.reject(error);
  }
);
installAdminSessionActionRefresh([boardHttp]);
bindAdminSessionRoutePath(() => router.currentRoute.value.path);

createApp(App).use(router).mount('#app');
