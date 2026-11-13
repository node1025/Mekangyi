import {defineConfig} from 'vite';import vue from '@vitejs/plugin-vue';import {fileURLToPath,URL} from 'node:url';
export default defineConfig({plugins:[vue()],server:{host:'127.0.0.1',port:5176,proxy:{'/api':'http://127.0.0.1:5002','/uploads':'http://127.0.0.1:8080'}},resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}}});
