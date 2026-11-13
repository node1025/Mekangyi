<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { boardApi } from '../../utils/boardApi';
import BoardWrite from './BoardWrite.vue';
import { useUserStore } from '../../utils/userStore';
const route = useRoute(); const router = useRouter(); const userStore = useUserStore();
const categories = [{ key: '', label: '전체 이야기' }, { key: 'notice', label: '공지사항' }, { key: 'qna', label: 'Q&A' }, { key: 'event', label: '이벤트' }, { key: 'free', label: '자유게시판' }];
const labels: Record<string,string> = { notice: 'NOTICE', qna: 'Q&A', event: 'EVENT', free: 'COMMUNITY' };
interface Post { _id:string; title:string; category:string; author:{name:string}; views:number; isPrivate:boolean; createdAt:string }
const posts=ref<Post[]>([]); const total=ref(0); const totalPages=ref(0); const loading=ref(true); const error=ref(''); const search=ref(''); const modal=ref(false);
const closeButton=ref<HTMLButtonElement|null>(null); const writeButton=ref<HTMLButtonElement|null>(null);
const category=computed(()=>typeof route.query.category === 'string' && categories.some(c=>c.key===route.query.category) ? route.query.category : '');
const page=computed(()=>{const n=Number(route.query.page || 1);return Number.isSafeInteger(n)&&n>0?n:1});
const pages=computed(()=>{const first=Math.max(1,Math.min(page.value-2,totalPages.value-4));return Array.from({length:Math.min(5,totalPages.value)},(_,i)=>first+i)});
let controller:AbortController|undefined; let version=0;
const date=(value:string)=>new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
async function fetchPosts(){
 const current=++version;controller?.abort();controller=new AbortController();loading.value=true;error.value='';
 search.value=typeof route.query.q==='string'?route.query.q.slice(0,100):'';
 try{const {data}=await boardApi.getPosts({category:category.value||undefined,page:page.value,search:search.value||undefined,limit:10},controller.signal);if(current!==version)return;posts.value=data.posts;total.value=data.total;totalPages.value=data.totalPages;if(page.value>Math.max(1,data.totalPages)){await navigate(category.value,1);}}
 catch(cause:any){if(current===version&&!axios.isCancel(cause)){posts.value=[];error.value=cause.response?.data?.message||'게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';}}
 finally{if(current===version)loading.value=false}
}
function navigate(key=category.value,newPage=1){return router.push({path:'/board',query:{...(key?{category:key}:{}),...(search.value.trim()?{q:search.value.trim()}:{}),...(newPage>1?{page:String(newPage)}:{})}});}
async function openModal(){if(userStore.isAdmin.value){alert('관리자 게시글은 별도 관리자 사이트에서 작성해주세요.');return}modal.value=true;await nextTick();closeButton.value?.focus()}
async function closeModal(){modal.value=false;await nextTick();writeButton.value?.focus()}
async function saved(){await closeModal();if(page.value!==1)await navigate(category.value,1);else await fetchPosts()}
function trapFocus(event:KeyboardEvent){if(event.key!=='Tab')return;const dialog=event.currentTarget as HTMLElement;const fields=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')];const first=fields[0],last=fields[fields.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
watch(()=>route.query,fetchPosts,{immediate:true});onUnmounted(()=>{version++;controller?.abort()});
</script>
<template>
 <div class="community-page">
  <header class="community-intro"><div><p class="board-eyebrow">부캉이 / COMMUNITY</p><h1>함께 나누는<br /><em>일상의 이야기.</em></h1><p class="intro-sub">부캉이의 소식과 궁금한 점, 그리고 당신의 이야기.</p></div><span class="intro-wordmark" aria-hidden="true">Let's<br />talk.</span></header>
  <section class="community-guides" aria-label="게시판 이용 안내"><button @click="navigate('notice')"><span>01 / BRAND NEWS</span><strong>새로운 소식을 가장 먼저</strong><small>공지사항과 브랜드 소식을 확인하세요. ↗</small></button><button @click="navigate('qna')"><span>02 / HOW CAN WE HELP?</span><strong>궁금한 점이 있으신가요?</strong><small>상품·배송·주문에 관한 질문을 남겨주세요. ↗</small></button></section>
  <section class="board-section" aria-label="게시글 목록">
   <div class="board-toolbar"><nav class="board-tabs" aria-label="게시판 카테고리"><button v-for="item in categories" :key="item.key" :class="{active:category===item.key}" :aria-pressed="category===item.key" @click="navigate(item.key)">{{item.label}}</button></nav><button v-if="userStore.isLoggedIn.value" ref="writeButton" class="board-primary" @click="openModal">글쓰기 <span>＋</span></button><RouterLink v-else to="/login" class="board-login">로그인 후 글쓰기 ↗</RouterLink></div>
   <div class="board-summary"><span>총 <strong>{{total}}</strong>개의 이야기</span><form @submit.prevent="navigate(category,1)" class="board-search"><label class="sr-only" for="board-search">게시글 제목 검색</label><input id="board-search" v-model="search" maxlength="100" placeholder="궁금한 이야기를 검색해보세요" type="search" /><button aria-label="게시글 검색">검색 ↗</button></form></div>
   <div v-if="loading" class="board-state" role="status"><div class="loading-line" v-for="n in 4" :key="n"></div><p>이야기를 불러오고 있습니다.</p></div>
   <div v-else-if="error" class="board-empty" role="alert"><span class="empty-mark">!</span><h2>잠시 연결이 원활하지 않아요.</h2><p>{{error}}</p><button class="board-outline" @click="fetchPosts">다시 불러오기</button></div>
   <div v-else-if="!posts.length" class="board-empty"><span class="empty-mark">“</span><h2>{{route.query.q?'검색 결과가 없습니다.':'첫 번째 이야기를 기다리고 있어요.'}}</h2><p>{{route.query.q?'다른 검색어로 찾아보세요.':'궁금한 점이나 나누고 싶은 이야기를 남겨주세요.'}}</p><button v-if="route.query.q" class="board-outline" @click="search = ''; navigate(category,1)">검색 초기화</button></div>
   <template v-else><div class="board-columns" aria-hidden="true"><span>NO.</span><span>CATEGORY</span><span>SUBJECT</span><span>WRITER / DATE</span><span>VIEWS</span></div><ol class="post-list"><li v-for="(post,index) in posts" :key="post._id"><span class="post-number">{{String(total-(page-1)*10-index).padStart(2,'0')}}</span><span :class="['post-category',post.category]">{{labels[post.category]||'COMMUNITY'}}</span><RouterLink :to="'/board/'+post._id" class="post-subject"><span v-if="post.isPrivate" class="private-tag">비밀글</span>{{post.title}}<span class="post-arrow" aria-hidden="true">↗</span></RouterLink><div class="post-byline"><span>{{post.author?.name||'탈퇴한 회원'}}</span><time :datetime="post.createdAt">{{date(post.createdAt)}}</time></div><span class="post-views"><span class="mobile-label">조회 </span>{{post.views}}</span></li></ol></template>
   <nav v-if="totalPages>1" class="board-pagination" aria-label="게시판 페이지 이동"><button :disabled="page<=1" aria-label="이전 페이지" @click="navigate(category,page-1)">←</button><button v-for="number in pages" :key="number" :class="{current:page===number}" :aria-current="page===number?'page':undefined" @click="navigate(category,number)">{{number}}</button><button :disabled="page>=totalPages" aria-label="다음 페이지" @click="navigate(category,page+1)">→</button></nav>
  </section>
  <p class="community-footnote">서로를 배려하는 따뜻한 이야기로 이 공간을 함께 채워주세요.</p>
  <Teleport to="body"><div v-if="modal" class="community-modal-backdrop" @click.self="closeModal" @keydown.esc="closeModal"><section class="community-modal" role="dialog" aria-modal="true" aria-labelledby="write-title" @keydown="trapFocus"><header><div><span class="board-eyebrow">YOUR STORY</span><h2 id="write-title">새로운 이야기</h2></div><button ref="closeButton" aria-label="글쓰기 닫기" @click="closeModal">×</button></header><BoardWrite @saved="saved" @close="closeModal" /></section></div></Teleport>
 </div>
</template>
<style scoped src="./BoardPage.css"></style>
