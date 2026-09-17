import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { COLORS, RADIUS } from './theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function LeftSheet({
  visible,
  onClose,
  children,
  width,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  style?: ViewStyle;
}) {
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateX.setValue(-SCREEN_WIDTH);
      backdropOpacity.setValue(0);
    }
  }, [visible, translateX, backdropOpacity]);

  const panelWidth = width ?? Math.min(SCREEN_WIDTH * 0.82, 340);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.backdrop,
            { opacity: backdropOpacity },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            { width: panelWidth, transform: [{ translateX }] },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: COLORS.backdrop },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.surface,
    borderTopRightRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#0f2c47',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 6, height: 0 },
    elevation: 16,
  },
});
