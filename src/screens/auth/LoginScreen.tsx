import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { Icon } from '../../components/common/Icon';
import { AuthError, type AuthErrorKind } from '../../services/auth/authClient';

export type LoginScreenProps = {
  onSubmit: (username: string, password: string) => Promise<void>;
  /**
   * true khi màn này hiện ra vì phiên hết hạn giữa chừng (không phải lần
   * đăng nhập đầu tiên) — thiết kế quyết định #3.
   */
  sessionExpired?: boolean;
};

export function LoginScreen({ onSubmit, sessionExpired }: LoginScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKind, setErrorKind] = useState<AuthErrorKind | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorKind(null);
    try {
      await onSubmit(username, password);
    } catch (error) {
      setErrorKind(error instanceof AuthError ? error.kind : 'unknown');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom },
        ]}
      >
        {sessionExpired ? (
          <View style={styles.sessionExpiredBanner}>
            <Icon name="warning" size={14} color={COLORS.warningText} />
            <Text style={styles.sessionExpiredText}>
              {t('auth.sessionExpiredBanner')}
            </Text>
          </View>
        ) : null}

        <View style={styles.brand}>
          <Image
            source={require('../../assets/images/Logo_IOC.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>{t('header.title')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.usernameLabel')}</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel={t('auth.usernameLabel')}
              editable={!submitting}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              accessibilityLabel={t('auth.passwordLabel')}
              editable={!submitting}
            />
          </View>

          {errorKind === 'invalid_credentials' ? (
            <Text style={styles.errorText}>{t('auth.invalidCredentials')}</Text>
          ) : null}
          {errorKind === 'network' || errorKind === 'unknown' ? (
            <View>
              <Text style={styles.errorText}>{t('auth.networkError')}</Text>
              <Pressable
                onPress={handleSubmit}
                accessibilityLabel={t('common.retry')}
                testID="login-retry"
              >
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.button, submitting && styles.buttonDisabled]}
            accessibilityLabel={t('auth.loginButton')}
            accessibilityState={{ disabled: submitting }}
            testID="login-submit"
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.surface} size="small" />
            ) : (
              <Text style={styles.buttonText}>{t('auth.loginButton')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
  },
  sessionExpiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.warningBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sessionExpiredText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warningText,
  },
  brand: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl * 1.5,
  },
  logo: { width: 64, height: 64, marginBottom: SPACING.md },
  appName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  form: { gap: SPACING.lg },
  field: { gap: SPACING.xs },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    minHeight: 44,
  },
  errorText: { fontSize: 13, color: COLORS.critical, fontWeight: '600' },
  retryText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  button: {
    minHeight: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.surface, fontSize: 15, fontWeight: '700' },
});
