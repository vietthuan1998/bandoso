import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n';
import { Icon } from './Icon';
import { COLORS, SPACING } from './theme';

export function Header({
  language,
  onMenuPress,
  onSearchPress,
  onLanguagePress,
  topInset,
}: {
  language: SupportedLanguage;
  onMenuPress: () => void;
  onSearchPress: () => void;
  onLanguagePress: () => void;
  topInset: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.wrap, { paddingTop: topInset + SPACING.sm }]}>
      <Pressable
        onPress={onMenuPress}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={t('header.toggleMenu')}
      >
        <Icon name="menu" size={20} color={COLORS.primaryDark} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {t('header.title')}
      </Text>
      <Pressable
        onPress={onLanguagePress}
        style={styles.langButton}
        accessibilityRole="button"
        accessibilityLabel={t('language.label')}
      >
        <Icon name="language" size={15} color={COLORS.primaryDark} />
        <Text style={styles.langText}>{language.toUpperCase()}</Text>
      </Pressable>
      <Pressable
        onPress={onSearchPress}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={t('header.openSearch')}
      >
        <Icon name="search" size={18} color={COLORS.primaryDark} />
      </Pressable>
    </View>
  );
}

export function LanguageOption({
  code,
  label,
  active,
  onPress,
}: {
  code: SupportedLanguage;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.langOption, active ? styles.langOptionActive : null]}
      accessibilityRole="button"
      accessibilityLabel={code}
    >
      <Text
        style={[
          styles.langOptionText,
          active ? styles.langOptionTextActive : null,
        ]}
      >
        {label}
      </Text>
      {active ? <Icon name="check" size={15} color={COLORS.primary} /> : null}
    </Pressable>
  );
}

export { SUPPORTED_LANGUAGES };

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    shadowColor: '#0f4165',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langText: { fontSize: 11, fontWeight: '700', color: COLORS.primaryDark },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  langOptionActive: { backgroundColor: '#eaf5fc' },
  langOptionText: { fontSize: 14, color: COLORS.text },
  langOptionTextActive: { color: COLORS.primaryDark, fontWeight: '700' },
});
