import { useCallback, useState } from "react";
import { PixelRatio, type LayoutChangeEvent } from "react-native";

/**
 * Lets a ScrollView scroll only while its content overflows its frame. On
 * Android a scrollable ScrollView is a keyboard and D-pad focus stop
 * (ReactScrollViewManager.setScrollEnabled sets isFocusable), so a block that
 * fits stays out of the keyboard order, and one that overflows (large text)
 * scrolls and can be reached. Give the content container flexGrow 1, so its
 * height equals the frame's whenever it fits.
 */
export function useOverflowScroll() {
  const [frameHeight, setFrameHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => setFrameHeight(event.nativeEvent.layout.height), []);
  const onContentSizeChange = useCallback((_width: number, height: number) => setContentHeight(height), []);
  // Compared in whole device pixels, so float noise never makes a fitting block scrollable.
  const scrollEnabled = PixelRatio.roundToNearestPixel(contentHeight) > PixelRatio.roundToNearestPixel(frameHeight);
  return { scrollEnabled, onLayout, onContentSizeChange };
}
