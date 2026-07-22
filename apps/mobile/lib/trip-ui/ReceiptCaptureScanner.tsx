import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { type ExpenseReceiptDraft, type ReceiptCaptureMode, type ReceiptImageRole } from '@i-um/api-contract';

import { PrimaryButton, SecondaryButton, theme } from '../design';
import {
  ExpenseReceiptUploadError,
  createExpenseReceiptDraftFromCapture,
  type ExpenseReceiptDraftImageInput,
} from '../trips/expense-api';
import {
  buildReceiptOCRTextParts,
  validateKoreanReceiptTextParts,
  type ReceiptOCRTextPart,
} from '../trips/receipt-ocr';
import { isReceiptOCRFixtureModeEnabled } from '../trips/receipt-ocr-fixture';
import { recognizeKoreanReceiptText } from '../trips/receipt-ocr-native';

type CapturedReceiptImage = ExpenseReceiptDraftImageInput & {
  role: ReceiptImageRole;
};

type ScannerStep = 'mode' | 'capture' | 'review' | 'recognizing' | 'failure';

const receiptOCRFixtureModeCopy =
  '개발 OCR fixture 사용 중이에요. 촬영 이미지는 업로드하고, 글자만 IMG_8925 결과로 보내 실제 OpenAI 정제를 확인해요.';

export function ReceiptCaptureScanner({
  onClose,
  onDirectInput,
  onDraftCreated,
  tripId,
  visible,
}: {
  tripId: string;
  visible: boolean;
  onClose: () => void;
  onDirectInput: () => void;
  onDraftCreated: (draft: ExpenseReceiptDraft) => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<ScannerStep>('mode');
  const [mode, setMode] = useState<ReceiptCaptureMode>('single');
  const [captureRole, setCaptureRole] = useState<ReceiptImageRole>('single');
  const [capturedImages, setCapturedImages] = useState<CapturedReceiptImage[]>([]);
  const [failureMessage, setFailureMessage] = useState(
    '이미지를 인식하지 못했어요. 다시 촬영하거나 직접 입력해주세요.',
  );
  const [takingPicture, setTakingPicture] = useState(false);
  const fixtureOCRModeEnabled = isReceiptOCRFixtureModeEnabled();

  useEffect(() => {
    if (!visible) {
      return;
    }
    setStep('mode');
    setMode('single');
    setCaptureRole('single');
    setCapturedImages([]);
    setFailureMessage('이미지를 인식하지 못했어요. 다시 촬영하거나 직접 입력해주세요.');
    setTakingPicture(false);
  }, [visible]);

  const beginCapture = (nextMode: ReceiptCaptureMode) => {
    setMode(nextMode);
    setCapturedImages([]);
    setCaptureRole(nextMode === 'split' ? 'header' : 'single');
    setStep('capture');
  };

  const takePicture = async () => {
    if (!cameraRef.current || takingPicture) {
      return;
    }
    setTakingPicture(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.92, skipProcessing: false });
      const image: CapturedReceiptImage = {
        role: captureRole,
        uri: picture.uri,
        contentType: 'image/jpeg',
        fileName: `${captureRole}-receipt.jpg`,
      };
      setCapturedImages((current) => {
        const next = [...current.filter((item) => item.role !== captureRole), image];
        if (mode === 'split' && captureRole === 'header') {
          setCaptureRole('total');
          setStep('capture');
        } else {
          setStep('review');
        }
        return next;
      });
    } catch {
      setFailureMessage('이미지를 인식하지 못했어요. 다시 촬영하거나 직접 입력해주세요.');
      setStep('failure');
    } finally {
      setTakingPicture(false);
    }
  };

  const retake = () => {
    setCapturedImages([]);
    setCaptureRole(mode === 'split' ? 'header' : 'single');
    setFailureMessage('이미지를 인식하지 못했어요. 다시 촬영하거나 직접 입력해주세요.');
    setStep('capture');
  };

  const recognizeAndCreateDraft = async () => {
    setStep('recognizing');
    try {
      const parts: ReceiptOCRTextPart[] = [];
      for (const image of capturedImages) {
        parts.push({ role: image.role, text: await recognizeKoreanReceiptText(image.uri, { role: image.role }) });
      }
      const textParts = buildReceiptOCRTextParts({ mode, parts });
      const validation = validateKoreanReceiptTextParts(textParts);
      if (!validation.ok) {
        setFailureMessage(
          validation.reason === 'unsupported-language'
            ? '한국어 영수증만 등록할 수 있어요. 다시 촬영하거나 직접 입력해주세요.'
            : '이미지를 인식하지 못했어요. 다시 촬영하거나 직접 입력해주세요.',
        );
        setStep('failure');
        return;
      }
      const response = await createExpenseReceiptDraftFromCapture({
        tripId,
        captureMode: mode,
        ocrTextParts: textParts,
        images: capturedImages,
      });
      onDraftCreated(response.draft);
    } catch (error) {
      setFailureMessage(receiptCaptureFailureMessage(error));
      setStep('failure');
    }
  };

  const useDirectInput = () => {
    onDirectInput();
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <View style={scannerStyles.screen}>
        <View style={scannerStyles.header}>
          <Text style={scannerStyles.title}>칫 영수증 스캔</Text>
          <SecondaryButton accessibilityLabel="영수증 촬영 닫기" label="닫기" onPress={onClose} />
        </View>

        {step === 'mode' ? (
          <View style={scannerStyles.card}>
            <Text style={scannerStyles.cardTitle}>영수증 초안을 만들게요.</Text>
            <Text style={scannerStyles.helper}>긴 영수증은 상단과 총액 부분을 나눠 크게 촬영해주세요.</Text>
            <PrimaryButton
              accessibilityLabel="영수증 한 번에 촬영 시작"
              label="한 번에 촬영"
              onPress={() => beginCapture('single')}
            />
            <SecondaryButton
              accessibilityLabel="긴 영수증 나눠찍기 시작"
              label="긴 영수증 나눠찍기"
              onPress={() => beginCapture('split')}
            />
          </View>
        ) : null}

        {step === 'capture' ? (
          <View style={scannerStyles.captureWrap}>
            {permission?.granted ? (
              <>
                <CameraView
                  ref={cameraRef}
                  active={visible && step === 'capture'}
                  facing="back"
                  mode="picture"
                  style={scannerStyles.camera}
                />
                <View style={scannerStyles.captureCard}>
                  <Text style={scannerStyles.cardTitle}>{captureInstruction(mode, captureRole)}</Text>
                  <Text style={scannerStyles.helper}>빛 반사 없이 흔들리지 않게 촬영해주세요.</Text>
                  <PrimaryButton
                    accessibilityLabel="영수증 촬영하기"
                    label={takingPicture ? '촬영 중...' : '촬영하기'}
                    loading={takingPicture}
                    loadingLabel="촬영 중..."
                    onPress={() => void takePicture()}
                  />
                  <SecondaryButton label="이전" onPress={() => setStep('mode')} />
                </View>
              </>
            ) : (
              <View style={scannerStyles.card}>
                <Text style={scannerStyles.cardTitle}>카메라 권한이 필요해요.</Text>
                <Text style={scannerStyles.helper}>영수증을 촬영하려면 카메라 접근을 허용해주세요.</Text>
                <PrimaryButton label="권한 허용" onPress={() => void requestPermission()} />
                <SecondaryButton
                  accessibilityLabel="영수증 직접 입력으로 전환"
                  label="직접 입력"
                  onPress={useDirectInput}
                />
              </View>
            )}
          </View>
        ) : null}

        {step === 'review' ? (
          <View style={scannerStyles.card}>
            <Text style={scannerStyles.cardTitle}>초안 만들기 전 확인</Text>
            <Text style={scannerStyles.helper}>글자가 흐리면 다시 촬영해주세요. 선명하면 바로 초안을 만들게요.</Text>
            {fixtureOCRModeEnabled ? <Text style={scannerStyles.helper}>{receiptOCRFixtureModeCopy}</Text> : null}
            <View style={scannerStyles.previewRow}>
              {capturedImages.map((image) => (
                <Image key={image.role} source={{ uri: image.uri }} style={scannerStyles.previewImage} />
              ))}
            </View>
            <PrimaryButton
              accessibilityLabel="영수증 이미지 인식하기"
              label="이미지 인식하기"
              onPress={() => void recognizeAndCreateDraft()}
            />
            <SecondaryButton accessibilityLabel="영수증 다시 촬영하기" label="다시 촬영" onPress={retake} />
          </View>
        ) : null}

        {step === 'recognizing' ? (
          <View style={scannerStyles.card}>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={scannerStyles.cardTitle}>칫, 글자를 읽는 중</Text>
            <Text style={scannerStyles.helper}>
              {fixtureOCRModeEnabled ? receiptOCRFixtureModeCopy : '금액과 날짜 초안을 만들고 있어요.'}
            </Text>
          </View>
        ) : null}

        {step === 'failure' ? (
          <View style={scannerStyles.card}>
            <Text style={scannerStyles.cardTitle}>초안을 만들 수 없어요.</Text>
            <Text style={scannerStyles.helper}>{failureMessage}</Text>
            <PrimaryButton accessibilityLabel="영수증 다시 촬영하기" label="다시 촬영" onPress={retake} />
            <SecondaryButton
              accessibilityLabel="영수증 직접 입력으로 전환"
              label="직접 입력"
              onPress={useDirectInput}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function captureInstruction(mode: ReceiptCaptureMode, role: ReceiptImageRole): string {
  if (mode === 'split' && role === 'header') {
    return '상호와 날짜가 크게 보이도록 촬영해주세요.';
  }
  if (mode === 'split' && role === 'total') {
    return '총액/결제금액이 크게 보이도록 촬영해주세요.';
  }
  return '영수증 전체가 보이고 글자가 선명하도록 촬영해주세요.';
}

function receiptCaptureFailureMessage(error: unknown): string {
  const status = error instanceof ExpenseReceiptUploadError ? error.status : undefined;
  if (status === 422) {
    return '한국어 영수증만 등록할 수 있어요. 다시 촬영하거나 직접 입력해주세요.';
  }
  if (status === 413) {
    return '영수증 이미지는 10MB 이하만 등록할 수 있어요. 다시 촬영하거나 직접 입력해주세요.';
  }
  return '이미지를 인식하지 못했어요. 다시 촬영하거나 직접 입력해주세요.';
}

const scannerStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    padding: theme.space[6],
    gap: theme.space[5],
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.space[6],
  },
  title: {
    color: theme.color.textStrong,
    fontSize: 22,
    fontWeight: '800',
  },
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[5],
    padding: theme.space[6],
  },
  cardTitle: {
    color: theme.color.textStrong,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 25,
  },
  helper: {
    color: theme.color.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  captureWrap: {
    flex: 1,
    gap: theme.space[5],
  },
  camera: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
  },
  captureCard: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  previewRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  previewImage: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    flex: 1,
    height: 220,
  },
});
