import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { COLORS, RADIUS } from './theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Chiều cao tối đa của sheet, tính bằng điểm (points). */
  maxHeight?: number;
  style?: ViewStyle;
}) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  /**
   * KeyboardAvoidingView (behavior="height") KHÔNG đủ trên Android khi sheet
   * này nằm trong <Modal>: Modal tạo một Dialog/Window riêng, không chắc
   * được Activity (đã đặt windowSoftInputMode="adjustResize" trong
   * AndroidManifest.xml) tự co lại đúng cách cho window đó, nên
   * KeyboardAvoidingView không tính đúng khoảng cần đệm — quan sát thực tế:
   * sheet ít nội dung vẫn bị bàn phím che dù đã bọc KeyboardAvoidingView.
   *
   * Sửa bằng cách tự nghe sự kiện Keyboard ở tầng thấp hơn (Keyboard module,
   * không qua lớp tính toán của KeyboardAvoidingView) rồi CHỦ ĐỘNG cộng
   * thêm đúng chiều cao bàn phím vào paddingBottom của sheet — cách này
   * không phụ thuộc việc window của Modal có tự resize hay không, chỉ cần
   * sự kiện keyboardDidShow/keyboardDidHide bắn ra (vẫn bắn dù trong Modal).
   */
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const showSub = Keyboard.addListener('keyboardDidShow', event => {
      setAndroidKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
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
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible, translateY, backdropOpacity]);

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
            styles.sheet,
            {
              maxHeight: maxHeight ?? SCREEN_HEIGHT * 0.82,
              transform: [{ translateY }],
              // Sheet định vị bằng position:absolute + bottom:0, chiều cao co
              // theo nội dung — nếu nội dung ít (vài dòng kết quả tìm kiếm),
              // sheet rất thấp và nằm lọt hẳn vào vùng bàn phím che phía dưới
              // màn hình. Trên Android, KeyboardAvoidingView không đủ tin cậy
              // khi sheet nằm trong <Modal> (xem ghi chú tại khai báo
              // androidKeyboardHeight ở trên) nên cộng thêm thủ công đúng
              // bằng chiều cao bàn phím vào paddingBottom — đẩy nội dung thật
              // nổi lên trên bàn phím, phần đệm rỗng phía dưới bị khuất sau
              // bàn phím thì không sao vì không có gì để nhìn ở đó.
              paddingBottom: androidKeyboardHeight,
            },
            style,
          ]}
        >
          <View style={styles.grabber} />
          {Platform.OS === 'ios' ? (
            // iOS: KeyboardAvoidingView hoạt động ổn định trong Modal, giữ
            // nguyên cách cũ (đệm padding co giãn theo animation bàn phím).
            <KeyboardAvoidingView behavior="padding">
              {children}
            </KeyboardAvoidingView>
          ) : (
            children
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: COLORS.backdrop },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#0f2c47',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d7e1ea',
    marginTop: 8,
    marginBottom: 4,
  },
});
