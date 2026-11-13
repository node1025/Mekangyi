export const goodsCategories = [
  { key: 'plush', label: '인형·키링', hint: '언제나 함께', image: 'bukangi_doll_keyring_1.png' },
  { key: 'living', label: '리빙', hint: '방 안의 작은 바다', image: 'bukangi_bowl_1.png' },
  { key: 'stationery', label: '문구·데스크', hint: '즐거운 책상 생활', image: 'bukangi_notebook_1.png' },
  { key: 'apparel', label: '의류', hint: '매일 입는 부캉이', image: 'bukangi_tshirt_1.png' }
] as const;
export const categoryNames: Record<string, string> = { plush: '인형·키링', living: '리빙', stationery: '문구·데스크', apparel: '의류', best: '전체 굿즈', all: '전체 굿즈' };
export const categoryDescriptions: Record<string, string> = { plush: '폭신한 친구를 곁에 두는 가장 귀여운 방법.', living: '익숙한 공간에 부캉이의 작은 행복을 더해요.', stationery: '공부도 일도, 부캉이와 함께라면 조금 더 즐겁게.', apparel: '좋아하는 마음을 입고, 오늘도 가볍게.', best: '좋아하는 부캉이를 일상 가까이.', all: '좋아하는 부캉이를 일상 가까이.' };
