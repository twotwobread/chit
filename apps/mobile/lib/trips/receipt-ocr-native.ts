import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

import { normalizeOCRText } from './receipt-ocr';

export async function recognizeKoreanReceiptText(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri, TextRecognitionScript.KOREAN);
  return normalizeOCRText(result.text ?? '');
}
