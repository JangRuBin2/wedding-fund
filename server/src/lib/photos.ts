/**
 * public/photos/<이름>.jpg 를 넣었으면 true로 바꿔 주세요.
 * false면 사진 대신 그라데이션만 보여요(없는 사진을 요청하지 않음)
 */
export const PHOTOS = {
  hero: false, // 홈 목표 카드 배경 (가로 사진, 1200px 이상)
  ring: false, // 결혼준비: 웨딩링
  home: false, // 결혼준비: 신혼집
  trip: false, // 결혼준비: 신혼여행
} as const;

export const photoUrl = (name: keyof typeof PHOTOS) => (PHOTOS[name] ? `url("/photos/${name}.jpg")` : undefined);
