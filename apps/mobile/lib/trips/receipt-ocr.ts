export type ReceiptCaptureMode = 'single' | 'split';
export type ReceiptImageRole = 'single' | 'header' | 'total';

export type ReceiptOCRTextPart = {
  role: ReceiptImageRole;
  text: string;
};

export type ReceiptOCRCapture = {
  mode: ReceiptCaptureMode;
  parts: ReceiptOCRTextPart[];
};

export type ReceiptOCRValidationResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported-language' | 'unreadable'; message: string };

const koreanReceiptKeywords = [
  '합계',
  '총액',
  '결제금액',
  '결제 금액',
  '승인금액',
  '받을금액',
  '부가세',
  '공급가액',
  '승인번호',
  '카드',
  '현금영수증',
  '매출전표',
  '사업자',
];

const totalAmountKeywords = ['합계', '총액', '결제금액', '결제 금액', '승인금액', '받을금액'];
const krwAmountPattern = /(?:₩\s*)?\d{1,3}(?:,\d{3})+\s*원?|\d+\s*원/g;
const hangulPattern = /[가-힣]/g;
const digitPattern = /\d/;

export function buildReceiptOCRTextParts(capture: ReceiptOCRCapture): ReceiptOCRTextPart[] {
  return capture.parts.map((part) => ({ role: part.role, text: normalizeOCRText(part.text) }));
}

export function validateKoreanReceiptTextParts(parts: ReceiptOCRTextPart[]): ReceiptOCRValidationResult {
  const normalizedParts = parts.map((part) => normalizeOCRText(part.text)).filter((text) => text.length > 0);
  const combined = normalizedParts.join('\n');
  if (combined.length < 20 || !digitPattern.test(combined)) {
    return { ok: false, reason: 'unreadable', message: '이미지를 인식하지 못했어요.' };
  }

  const hangulCount = (combined.match(hangulPattern) ?? []).length;
  if (hangulCount < 2) {
    return { ok: false, reason: 'unsupported-language', message: '한국어 영수증만 등록할 수 있어요.' };
  }

  const keywordCount = koreanReceiptKeywords.reduce(
    (count, keyword) => count + (combined.includes(keyword) ? 1 : 0),
    0,
  );
  const hasTotalKeyword = totalAmountKeywords.some((keyword) => combined.includes(keyword));
  const hasKRWAmount = krwAmountPattern.test(combined) || combined.includes('₩');

  let score = 0;
  if (hangulCount >= 5) score += 2;
  else if (hangulCount >= 2) score += 1;
  if (keywordCount >= 1) score += 2;
  if (keywordCount >= 2) score += 1;
  if (hasTotalKeyword) score += 2;
  if (hasKRWAmount) score += 2;

  if (!hasTotalKeyword && !hasKRWAmount) {
    return { ok: false, reason: 'unreadable', message: '이미지를 인식하지 못했어요.' };
  }
  if (score < 4) {
    return { ok: false, reason: 'unsupported-language', message: '한국어 영수증만 등록할 수 있어요.' };
  }
  return { ok: true };
}

export function normalizeOCRText(text: string): string {
  return text
    .normalize('NFKC')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s{2,}/g, ' '))
    .filter(Boolean)
    .join('\n')
    .trim();
}
