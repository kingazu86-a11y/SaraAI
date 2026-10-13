import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  useWindowDimensions,
  TouchableWithoutFeedback,
  Keyboard,
  BackHandler,
} from 'react-native';
import { useAssistant } from '../../store/AssistantStore';

interface PushDrawerLayoutProps {
  drawer: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  isGestureDisabled?: boolean;
}

const EDGE_SWIPE_THRESHOLD = 40; // Pixels from left edge where thumb swipe can trigger drawer open
const VELOCITY_THRESHOLD = 0.35; // px/ms threshold for flick gesture to snap open/closed

export const PushDrawerLayout: React.FC<PushDrawerLayoutProps> = ({
  drawer,
  children,
  isOpen,
  onOpen,
  onClose,
  isGestureDisabled = false,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const sidebarWidth = Math.min(screenWidth * 0.82, 340);
  const { theme } = useAssistant();

  // Primary hardware-accelerated translation (0 = fully closed, sidebarWidth = fully open)
  const currentX = useRef(new Animated.Value(isOpen ? sidebarWidth : 0)).current;
  const currentXValRef = useRef<number>(isOpen ? sidebarWidth : 0);

  // Gesture state references
  const startXRef = useRef<number>(isOpen ? sidebarWidth : 0);
  const touchStartXRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);
  const isOpenRef = useRef<boolean>(isOpen);
  isOpenRef.current = isOpen;

  // Backdrop overlay interaction state
  const [isBackdropActive, setIsBackdropActive] = useState<boolean>(isOpen);

  // Sync internal coordinate cache with native animated value
  useEffect(() => {
    const id = currentX.addListener(({ value }) => {
      currentXValRef.current = value;
    });
    return () => {
      currentX.removeListener(id);
    };
  }, [currentX]);

  // Physics-based spring settling with momentum preservation
  const snapTo = useCallback(
    (toOpen: boolean, velocity: number = 0) => {
      const toValue = toOpen ? sidebarWidth : 0;
      isAnimatingRef.current = true;

      if (toOpen) {
        setIsBackdropActive(true);
      }

      currentX.stopAnimation();

      const clampedVelocity = Math.max(-2.5, Math.min(2.5, velocity));

      Animated.spring(currentX, {
        toValue,
        velocity: clampedVelocity,
        damping: 24,
        mass: 0.85,
        stiffness: 240,
        overshootClamping: true,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
        useNativeDriver: true,
      }).start(({ finished }) => {
        isAnimatingRef.current = false;
        if (finished) {
          if (toOpen) {
            onOpen();
          } else {
            setIsBackdropActive(false);
            onClose();
          }
        }
      });
    },
    [currentX, sidebarWidth, onOpen, onClose]
  );

  // Synchronize with external store toggles (header menu button, conversation selection)
  useEffect(() => {
    if (isDraggingRef.current) return;

    const targetVal = isOpen ? sidebarWidth : 0;
    if (Math.abs(currentXValRef.current - targetVal) > 1) {
      snapTo(isOpen, 0);
    }
  }, [isOpen, sidebarWidth, snapTo]);

  // Android hardware back button integration
  useEffect(() => {
    const onBackPress = () => {
      if (isOpenRef.current || currentXValRef.current > 10) {
        snapTo(false, 0);
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [snapTo]);

  // Coordinated 1:1 Thumb Pan Responder
  const panResponder = useRef(
    PanResponder.create({
      // Interrupt running animation immediately if user touches screen mid-flight
      onStartShouldSetPanResponderCapture: () => {
        if (isGestureDisabled) return false;
        if (isAnimatingRef.current) {
          return true;
        }
        return false;
      },

      onMoveShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (isGestureDisabled) return false;

        const touchX = evt.nativeEvent.pageX;
        const isClosed = !isOpenRef.current && currentXValRef.current <= 5;

        if (isClosed) {
          // Closed state: require touch starting within left edge zone and predominantly horizontal swipe
          const isFromLeftEdge = touchX <= EDGE_SWIPE_THRESHOLD;
          const isMovingRight = gestureState.dx > 6;
          const isHorizontal =
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;

          return isFromLeftEdge && isMovingRight && isHorizontal;
        }

        // Open state: allow dragging left from anywhere on the screen
        const isMovingLeft = gestureState.dx < -6;
        const isHorizontal =
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;
        const isTouchOnPushedScreen = touchX >= sidebarWidth;

        return (
          (isMovingLeft && isHorizontal) ||
          (isTouchOnPushedScreen && Math.abs(gestureState.dx) > 6)
        );
      },

      onPanResponderGrant: (evt) => {
        Keyboard.dismiss();
        isDraggingRef.current = true;
        isAnimatingRef.current = false;
        setIsBackdropActive(true);

        // Stop any running animation immediately and record current coordinate
        currentX.stopAnimation();
        startXRef.current = currentXValRef.current;
        touchStartXRef.current = evt.nativeEvent.pageX;
      },

      onPanResponderMove: (evt) => {
        if (!isDraggingRef.current) return;

        const deltaX = evt.nativeEvent.pageX - touchStartXRef.current;
        let nextX = startXRef.current + deltaX;

        // Hard clamp between 0 and sidebarWidth to guarantee perfect boundaries
        nextX = Math.max(0, Math.min(sidebarWidth, nextX));

        currentX.setValue(nextX);
      },

      onPanResponderRelease: (_evt, gestureState) => {
        isDraggingRef.current = false;
        const pos = currentXValRef.current;
        const vx = gestureState.vx;

        let shouldOpen = false;
        if (vx > VELOCITY_THRESHOLD) {
          shouldOpen = true;
        } else if (vx < -VELOCITY_THRESHOLD) {
          shouldOpen = false;
        } else {
          shouldOpen = pos > sidebarWidth * 0.4;
        }

        snapTo(shouldOpen, vx);
      },

      onPanResponderTerminate: (_evt, gestureState) => {
        isDraggingRef.current = false;
        const pos = currentXValRef.current;
        const shouldOpen = pos > sidebarWidth * 0.5;
        snapTo(shouldOpen, gestureState.vx || 0);
      },
    })
  ).current;

  // Coordinated drawer translation: moves from -sidebarWidth to 0
  const drawerTranslateX = currentX.interpolate({
    inputRange: [0, sidebarWidth],
    outputRange: [-sidebarWidth, 0],
    extrapolate: 'clamp',
  });

  // Dimming backdrop opacity over pushed screen
  const backdropOpacity = currentX.interpolate({
    inputRange: [0, sidebarWidth],
    outputRange: [0, 0.4],
    extrapolate: 'clamp',
  });

  const handleBackdropPress = () => {
    snapTo(false, 0);
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* 
        Drawer Slot:
        Positioned at left: 0, translating from -sidebarWidth to 0.
        Anchored cleanly without negative container offsets.
      */}
      <Animated.View
        style={[
          styles.drawerSlot,
          {
            width: sidebarWidth,
            backgroundColor: theme.sidebarBg,
            transform: [{ translateX: drawerTranslateX }],
          },
        ]}
      >
        {drawer}
      </Animated.View>

      {/* 
        Main Screen Slot:
        Positioned at left: 0, translating from 0 to sidebarWidth in 1:1 lockstep.
        The right edge of drawer and left edge of main screen are identical at every microsecond.
      */}
      <Animated.View
        style={[
          styles.mainScreenSlot,
          {
            width: screenWidth,
            backgroundColor: theme.background,
            borderLeftColor: theme.border,
            transform: [{ translateX: currentX }],
          },
        ]}
      >
        {children}

        {/* Coordinated Dimming & Tap-to-Close Backdrop Overlay */}
        <Animated.View
          pointerEvents={isBackdropActive ? 'auto' : 'none'}
          style={[
            styles.backdropOverlay,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <TouchableWithoutFeedback onPress={handleBackdropPress}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  drawerSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  mainScreenSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
  },
  backdropOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    zIndex: 100,
  },
});
