<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useCatalog, imageUrl } from '../utils/catalog';
import { goodsCategories } from '../utils/goods';
import ProductCard from '../components/product/ProductCard.vue';
const slides = [
 { image:'/banners/01-bukangi-everyday.png', title:'오늘도 부캉이랑! 좋아하는 마음을, 일상 가까이.', code:'bukangi_plush_doll', label:'HELLO, BUKANGI', action:'폭신한 부캉이 만나기' },
 { image:'/banners/02-bukangi-desk.png', title:'책상 위에도 작은 바다 한 조각. 노트·마우스패드·머그볼.', code:'bukangi_notebook', label:'MY LITTLE DESK', action:'데스크 굿즈 구경하기' },
 { image:'/banners/03-bukangi-cozy.png', title:'포근한 하루의 끝, 부캉이가 함께해요. 곁에 두고 싶은 작은 행복.', code:'bukangi_mood_light', label:'A COZY LITTLE NIGHT', action:'포근한 리빙 굿즈 보기' }
];
const slideIndex=ref(0); const paused=ref(false); const hovered=ref(false); const focused=ref(false);
let timer:ReturnType<typeof setInterval>|undefined; let touchX=0;
function changeSlide(delta:number){slideIndex.value=(slideIndex.value+delta+slides.length)%slides.length}
function endSwipe(event:TouchEvent){const delta=(event.changedTouches[0]?.clientX??touchX)-touchX;if(Math.abs(delta)>50)changeSlide(delta<0?1:-1)}
onMounted(()=>{paused.value=window.matchMedia('(prefers-reduced-motion: reduce)').matches;timer=setInterval(()=>{if(!paused.value&&!hovered.value&&!focused.value&&document.visibilityState==='visible')changeSlide(1)},6000)});
onUnmounted(()=>clearInterval(timer));
const {products,loading,error,refresh}=useCatalog();
const pickCodes=['bukangi_plush_doll','bukangi_doll_keyring','bukangi_mood_light','bukangi_bowl'];
const picks=computed(()=>pickCodes.flatMap(code=>products.value.filter(p=>p.productCode===code)));
const daily=computed(()=>['bukangi_notebook','bukangi_mousepad','bukangi_tshirt'].flatMap(code=>products.value.filter(p=>p.productCode===code)));
</script>
<template>
 <div class="goods-home">
  <section class="goods-carousel" aria-roledescription="캐러셀" aria-label="부캉이 굿즈 컬렉션" @mouseenter="hovered=true" @mouseleave="hovered=false" @focusin="focused=true" @focusout="focused=false" @keydown.left.prevent="changeSlide(-1)" @keydown.right.prevent="changeSlide(1)" @touchstart.passive="touchX=$event.touches[0]?.clientX||0" @touchend.passive="endSwipe">
   <RouterLink :to="'/product/'+slides[slideIndex]!.code" class="banner-image"><img :src="slides[slideIndex]!.image" :alt="slides[slideIndex]!.title" fetchpriority="high" /></RouterLink>
   <div class="banner-bottom"><RouterLink :to="'/product/'+slides[slideIndex]!.code" class="banner-action">{{slides[slideIndex]!.action}} <span>↗</span></RouterLink><div class="banner-dots"><button v-for="(slide,index) in slides" :key="slide.code" :class="{active:slideIndex===index}" :aria-label="(index+1)+'번 배너 보기'" :aria-current="slideIndex===index?'true':undefined" @click="slideIndex=index"></button></div><div class="banner-controls"><button aria-label="이전 배너" @click="changeSlide(-1)">←</button><span>{{String(slideIndex+1).padStart(2,'0')}} <small>/ 03</small></span><button aria-label="다음 배너" @click="changeSlide(1)">→</button><button :aria-label="paused?'배너 자동 재생':'배너 자동 재생 정지'" :aria-pressed="paused" @click="paused=!paused">{{paused?'▶':'■'}}</button></div></div>
  </section>
  <section class="category-section" aria-label="굿즈 카테고리"><RouterLink v-for="category in goodsCategories" :key="category.key" :to="'/category/'+category.key" class="category-tile"><div :class="['category-picture',category.key]"><img :src="imageUrl('uploads/bukangi/'+category.image)" :alt="category.label" loading="lazy" /></div><strong>{{category.label}}</strong><span>{{category.hint}}</span></RouterLink></section>
  <section class="goods-section" aria-labelledby="picks-title"><header class="section-top"><div><p class="goods-kicker">BUKANGI'S LITTLE PICKS</p><h1 id="picks-title">어떤 부캉이를 데려갈까요?<span>곁에 두고 싶은 귀여움을 골라보세요.</span></h1></div><RouterLink to="/category/best">전체 굿즈 보기 ↗</RouterLink></header>
   <div v-if="loading" class="goods-skeleton" role="status" aria-label="상품을 불러오는 중"><div v-for="n in 4" :key="n"></div></div><div v-else-if="error" class="goods-state" role="alert"><p>{{error}}</p><button @click="refresh">다시 불러오기</button></div><div v-else-if="!picks.length" class="goods-state">귀여운 친구들을 준비하고 있어요.</div><div v-else class="goods-grid"><ProductCard v-for="product in picks" :key="product._id" :product="product" /></div>
  </section>
  <section class="daily-story"><div class="daily-story-copy"><p class="goods-kicker">HAPPINESS, WITHIN REACH</p><h2>평범한 하루에도<br /><em>부캉이 한 스푼.</em></h2><p>좋아하는 노트에 하루를 적고,<br />포근한 티셔츠를 입는 작은 순간.<br />당신의 일상에 부캉이가 살짝 찾아갈게요.</p><RouterLink to="/category/stationery">나의 데스크 친구 찾기 ↗</RouterLink></div><RouterLink class="daily-story-image" to="/product/bukangi_mousepad"><img :src="imageUrl('uploads/bukangi/bukangi_mousepad_1.png')" alt="부캉이 마우스패드와 노트가 있는 책상" loading="lazy" /></RouterLink></section>
  <section v-if="daily.length&&!error" class="goods-section daily-products" aria-labelledby="daily-title"><header class="section-top"><div><p class="goods-kicker">LITTLE THINGS, BIG HAPPINESS</p><h2 id="daily-title">매일 함께하는 작은 행복<span>손이 닿는 곳마다 부캉이와 함께.</span></h2></div><RouterLink to="/category/best">모두 둘러보기 ↗</RouterLink></header><div class="goods-grid three"><ProductCard v-for="product in daily" :key="product._id" :product="product" /></div></section>
  <section class="meet-bukangi"><img src="/brand/bukangi_character_2.png" alt="노란 별을 안고 웃는 부캉이" loading="lazy" /><div><p class="goods-kicker">SAY HELLO TO BUKANGI</p><h2>반가워요,<br />나는 부캉이에요!</h2><p>파란 상어 후드 속에 숨어 있는 동그란 미소.<br />좋아하는 마음을 가득 안고 당신을 만나러 왔어요.</p><RouterLink to="/about">부캉이 이야기 만나기 ↗</RouterLink></div></section>
  <section class="community-invite"><span aria-hidden="true">♡</span><div><p class="goods-kicker">OUR HAPPY LITTLE COMMUNITY</p><h2>당신의 부캉이는 어떻게 지내나요?</h2><p>함께하는 일상도, 궁금한 이야기도 들려주세요.</p></div><RouterLink to="/board">커뮤니티 놀러 가기 ↗</RouterLink></section>
 </div>
</template>
<style scoped src="./HomePage.css"></style>
