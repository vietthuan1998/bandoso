import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { COLORS, RADIUS, SPACING } from './theme';

export function InfoCard({
  title,
  subtitle,
  accentColor,
  onClose,
  closeLabel,
  children,
  bottomOffset = 0,
}: {
  title: string;
  subtitle?: string;
  accentColor?: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
  bottomOffset?: number;
}) {
  return (
    <View style={[styles.card, { bottom: SPACING.md + bottomOffset }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {subtitle ? (
            <View style={styles.subtitleRow}>
              {accentColor ? (
                <View style={[styles.dot, { backgroundColor: accentColor }]} />
              ) : null}
              <Text
                style={[
                  styles.subtitle,
                  accentColor ? { color: accentColor } : null,
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel ?? 'Đóng'}
          hitSlop={10}
          style={styles.closeButton}
        >
          <Icon name="close" size={16} color={COLORS.textMuted} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    maxHeight: '58%',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#17263c',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: '#f8fafc',
  },
  headerText: { flex: 1, minWidth: 0 },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: COLORS.textFaint,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 20,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef3f7',
  },
  body: { paddingHorizontal: SPACING.lg },
  bodyContent: { paddingVertical: SPACING.md, gap: SPACING.md },
});
