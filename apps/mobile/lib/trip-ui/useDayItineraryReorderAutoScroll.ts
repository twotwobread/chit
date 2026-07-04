import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import { resolveDayItineraryDragAutoScrollOffset } from '../trips/reorder-itinerary-drag';

type DayItineraryScrollMetrics = {
  offsetY: number;
  viewportHeight: number;
  contentHeight: number;
};

export function useDayItineraryReorderAutoScroll() {
  const [isReorderDragging, setIsReorderDragging] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollMetricsRef = useRef<DayItineraryScrollMetrics>({ offsetY: 0, viewportHeight: 0, contentHeight: 0 });
  const reorderDragPointerYRef = useRef<number | null>(null);
  const reorderAutoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateScrollOffset = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollMetricsRef.current.offsetY = event.nativeEvent.contentOffset.y;
  }, []);

  const updateScrollLayout = useCallback((event: LayoutChangeEvent) => {
    scrollMetricsRef.current.viewportHeight = event.nativeEvent.layout.height;
  }, []);

  const updateScrollContentSize = useCallback((_width: number, height: number) => {
    scrollMetricsRef.current.contentHeight = height;
  }, []);

  const getReorderScrollOffsetY = useCallback(() => scrollMetricsRef.current.offsetY, []);

  const applyReorderAutoScroll = useCallback((pointerY: number) => {
    const metrics = scrollMetricsRef.current;
    const nextOffsetY = resolveDayItineraryDragAutoScrollOffset({
      pointerY,
      viewportHeight: metrics.viewportHeight,
      contentHeight: metrics.contentHeight,
      currentOffsetY: metrics.offsetY,
    });
    if (nextOffsetY === null) {
      return;
    }

    scrollMetricsRef.current.offsetY = nextOffsetY;
    scrollViewRef.current?.scrollTo({ y: nextOffsetY, animated: false });
  }, []);

  const stopReorderAutoScroll = useCallback(() => {
    if (reorderAutoScrollTimerRef.current) {
      clearInterval(reorderAutoScrollTimerRef.current);
      reorderAutoScrollTimerRef.current = null;
    }
    reorderDragPointerYRef.current = null;
  }, []);

  const startReorderAutoScroll = useCallback(() => {
    if (reorderAutoScrollTimerRef.current) {
      return;
    }

    reorderAutoScrollTimerRef.current = setInterval(() => {
      const pointerY = reorderDragPointerYRef.current;
      if (pointerY !== null) {
        applyReorderAutoScroll(pointerY);
      }
    }, 16);
  }, [applyReorderAutoScroll]);

  const setReorderDragActive = useCallback(
    (isActive: boolean) => {
      setIsReorderDragging(isActive);
      if (isActive) {
        startReorderAutoScroll();
        return;
      }

      stopReorderAutoScroll();
    },
    [startReorderAutoScroll, stopReorderAutoScroll],
  );

  const requestReorderAutoScroll = useCallback(
    (pointerY: number) => {
      reorderDragPointerYRef.current = pointerY;
      applyReorderAutoScroll(pointerY);
      startReorderAutoScroll();
    },
    [applyReorderAutoScroll, startReorderAutoScroll],
  );

  useEffect(() => stopReorderAutoScroll, [stopReorderAutoScroll]);

  return {
    getReorderScrollOffsetY,
    isReorderDragging,
    requestReorderAutoScroll,
    scrollViewRef,
    setReorderDragActive,
    updateScrollContentSize,
    updateScrollLayout,
    updateScrollOffset,
  };
}
