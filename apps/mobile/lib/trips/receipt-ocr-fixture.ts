import type { ReceiptImageRole } from '@i-um/api-contract';

export const receiptOCRFixtureModeIMG8925 = 'fixture-img-8925';

export type ReceiptOCRFixtureMode = typeof receiptOCRFixtureModeIMG8925;

const img8925HeaderOCRText = `[상호] 주식회사비플랜트
[사업자번호] 813-88-01090 [전화] 1024481022
[대표] 김소영
[주소] 서울특별시 마포구 월드컵로 14길 108, 지층
[일시] 2026년 7월 4일 토요일 오후 12:46:47`;

const img8925TotalOCRText = `상품명 단가 수량 금액
001 *피자 17,800 1 17,800
합계금액 : 17,800원
부가세 상품가액 : 17,800원
부가세 면세 상품가액 : 0원
부가세 과세 상품가액 : 0원
총결제금액 : 17,800원
카드결제 : 17,800원
기프트 : 0원
승인번호 : 30020202
승인금액 : 17,800원
카드사명 : KB국민카드
할부 : 일시불
카드번호 : 55704290********
회원명 : 이수영
금액상품포인트 : 178
가용 포인트 : 1,860
담당자명 : POSMASTER`;

const img8925SingleOCRText = `${img8925HeaderOCRText}\n\n${img8925TotalOCRText}`;

export function resolveReceiptOCRFixtureMode(
  value = process.env.EXPO_PUBLIC_RECEIPT_OCR_MODE,
): ReceiptOCRFixtureMode | null {
  return value?.trim() === receiptOCRFixtureModeIMG8925 ? receiptOCRFixtureModeIMG8925 : null;
}

export function isReceiptOCRFixtureModeEnabled(value = process.env.EXPO_PUBLIC_RECEIPT_OCR_MODE): boolean {
  return resolveReceiptOCRFixtureMode(value) !== null;
}

export function getReceiptOCRFixtureText(role: ReceiptImageRole, mode = resolveReceiptOCRFixtureMode()): string | null {
  if (mode !== receiptOCRFixtureModeIMG8925) {
    return null;
  }
  switch (role) {
    case 'header':
      return img8925HeaderOCRText;
    case 'total':
      return img8925TotalOCRText;
    case 'single':
      return img8925SingleOCRText;
    default:
      return img8925SingleOCRText;
  }
}
