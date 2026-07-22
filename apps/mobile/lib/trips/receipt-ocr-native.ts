import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

import type { ReceiptImageRole } from '@i-um/api-contract';

import { getReceiptOCRFixtureText } from './receipt-ocr-fixture';
import { normalizeOCRText } from './receipt-ocr';

export type RecognizeKoreanReceiptTextOptions = {
  role?: ReceiptImageRole;
};

export async function recognizeKoreanReceiptText(
  uri: string,
  options: RecognizeKoreanReceiptTextOptions = {},
): Promise<string> {
  const fixtureText = getReceiptOCRFixtureText(options.role ?? 'single');
  if (fixtureText !== null) {
    return normalizeOCRText(fixtureText);
  }
  const result = await TextRecognition.recognize(uri, TextRecognitionScript.KOREAN);
  return normalizeOCRText(result.text ?? '');
}
