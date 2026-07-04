import { useRef, useState } from 'react';
import { PanResponder, Text, View, type LayoutChangeEvent } from 'react-native';

import { Badge, PlacePin, PlaceTag, theme } from '../design';
import type { DayItineraryReorderDraftViewModel } from '../trips/reorder-itinerary';
import { resolveDayItineraryDragOffsetY, resolveDayItineraryDragTargetIndex } from '../trips/reorder-itinerary-drag';
import { styles } from './DayItineraryEditorStyles';

export function ReorderPlaceList({
  draft,
  getScrollOffsetY,
  isDisabled,
  onDragActiveChange,
  onDragMove,
  onMoveItem,
}: {
  draft: DayItineraryReorderDraftViewModel;
  getScrollOffsetY: () => number;
  isDisabled: boolean;
  onDragActiveChange: (isActive: boolean) => void;
  onDragMove: (pointerY: number) => void;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
}) {
  const rowHeightsRef = useRef<Record<string, number>>({});
  const dragRef = useRef<{
    itemId: string;
    currentIndex: number;
    startIndex: number;
    startPointerY: number;
    startScrollOffsetY: number;
    snapshotHeights: number[];
  } | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const updateRowHeight = (itemId: string, event: LayoutChangeEvent) => {
    rowHeightsRef.current[itemId] = event.nativeEvent.layout.height;
  };

  const finishDrag = () => {
    dragRef.current = null;
    setActiveItemId(null);
    onDragActiveChange(false);
  };

  return draft.items.map((item, index) => {
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => !isDisabled,
      onStartShouldSetPanResponderCapture: () => !isDisabled,
      onMoveShouldSetPanResponder: () => !isDisabled,
      onMoveShouldSetPanResponderCapture: () => !isDisabled,
      onPanResponderGrant: (_, gestureState) => {
        dragRef.current = {
          itemId: item.id,
          currentIndex: index,
          startIndex: index,
          startPointerY: gestureState.y0,
          startScrollOffsetY: getScrollOffsetY(),
          snapshotHeights: draft.items.map((draftItem) => rowHeightsRef.current[draftItem.id] ?? theme.layout.controlH),
        };
        setActiveItemId(item.id);
        onDragActiveChange(true);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!dragRef.current || dragRef.current.itemId !== item.id) {
          return;
        }

        onDragMove(gestureState.moveY);
        const dragOffsetY = resolveDayItineraryDragOffsetY({
          pointerY: gestureState.moveY,
          startPointerY: dragRef.current.startPointerY,
          currentScrollOffsetY: getScrollOffsetY(),
          startScrollOffsetY: dragRef.current.startScrollOffsetY,
        });
        const targetIndex = resolveDayItineraryDragTargetIndex({
          startIndex: dragRef.current.startIndex,
          dragOffsetY,
          rowHeights: dragRef.current.snapshotHeights,
          fallbackRowHeight: theme.layout.controlH,
        });
        if (targetIndex === dragRef.current.currentIndex) {
          return;
        }

        onMoveItem(dragRef.current.currentIndex, targetIndex);
        dragRef.current.currentIndex = targetIndex;
      },
      onPanResponderReject: finishDrag,
      onPanResponderRelease: finishDrag,
      onPanResponderTerminate: finishDrag,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });

    const isActive = activeItemId === item.id;

    return (
      <View
        key={item.id}
        onLayout={(event) => updateRowHeight(item.id, event)}
        style={[styles.placeRow, isActive ? styles.placeRowActive : null]}
      >
        <PlacePin order={item.orderLabel} type={item.placeType} />
        <View style={styles.placeContent}>
          <View style={styles.placeTitleRow}>
            <Text style={styles.placeName}>{item.placeName}</Text>
            {item.itemType === 'non_place' ? (
              <Badge label={item.placeTypeLabel} tone="primary" />
            ) : (
              <PlaceTag type={item.placeType} />
            )}
            {item.statusLabel ? <Badge label={item.statusLabel} tone="neutral" /> : null}
          </View>
          {item.timeLabel ? <Text style={styles.timeLabel}>{item.timeLabel}</Text> : null}
          {item.address ? <Text style={styles.address}>{item.address}</Text> : null}
        </View>
        <View
          accessibilityHint="핸들을 잡고 위아래로 끌어서 순서를 바꿔요."
          accessibilityLabel={`${item.placeName} ${item.dragHandleLabel} 핸들`}
          accessibilityRole="button"
          style={[styles.dragHandle, isActive ? styles.dragHandleActive : null]}
          {...responder.panHandlers}
        >
          <View style={styles.dragHandleBar} />
          <View style={styles.dragHandleBar} />
          <View style={styles.dragHandleBar} />
        </View>
      </View>
    );
  });
}
