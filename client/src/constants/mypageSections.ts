export const MYPAGE_SECTIONS = ['profile', 'address', 'orders', 'wishlist', 'qna', 'withdraw'] as const;

export type MypageSection = (typeof MYPAGE_SECTIONS)[number];

export function resolveMypageSection(value: unknown): MypageSection {
  const s = typeof value === 'string' ? value : '';
  return (MYPAGE_SECTIONS as readonly string[]).includes(s) ? (s as MypageSection) : 'profile';
}
