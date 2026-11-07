import {createRouter,createWebHistory} from 'vue-router';
import axios from 'axios';
import Login from '../views/Login.vue';
import AdminAccess from '../views/AdminAccess.vue';
import AdminPage from '../views/AdminPage.vue';
const router=createRouter({history:createWebHistory(),scrollBehavior:()=>({top:0}),routes:[{path:'/',redirect:'/login'},{path:'/login',component:Login},{path:'/admin/access',component:AdminAccess},{path:'/admin',component:AdminPage,meta:{requiresAdmin:true}},{path:'/:pathMatch(.*)*',redirect:'/login'}]});
router.beforeEach(async to=>{if(to.meta.requiresAdmin){try{await axios.get('/api/admin/session')}catch{return '/admin/access'}}});
export default router;
