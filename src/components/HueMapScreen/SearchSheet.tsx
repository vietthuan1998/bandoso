import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { COLORS, SPACING } from './theme';

function Separator() {
  return <View style={styles.separator} />;
}

export type SearchResult = {
  id: string;
  kind: 'ward' | 'project';
  title: string;
  layer: string;
  detail: string;
  color: string;
};

export function SearchSheet({
  visible,
  onClose,
  query,
  onQueryChange,
  results,
  totalCount,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResult[];
  totalCount: number;
  onSelect: (result: SearchResult) => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={undefined}>
      <View style={styles.searchBarRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={COLORS.textFaint} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={t('header.searchPlaceholder')}
            placeholderTextColor={COLORS.textFaint}
            style={styles.input}
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              onPress={() => onQueryChange('')}
              hitSlop={8}
              accessibilityLabel={t('header.clearSearch')}
            >
              <Icon name="close" size={15} color={COLORS.textFaint} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={onClose} style={styles.cancelButton}>
          <Text style={styles.cancelText}>{t('common.close')}</Text>
        </Pressable>
      </View>

      {query.trim() ? (
        <>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsHeaderText}>
              {t('header.searchResults')}
            </Text>
            <Text style={styles.resultsHeaderText}>
              {t('header.resultCount', { count: totalCount })}
            </Text>
          </View>
          <FlatList
            data={results}
            keyExtractor={item => `${item.kind}-${item.id}`}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t('header.noResults')}</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.resultRow}
                onPress={() => onSelect(item)}
              >
                <View
                  style={[styles.resultDot, { backgroundColor: item.color }]}
                />
                <View style={styles.resultBody}>
                  <Text style={styles.resultLayer} numberOfLines={1}>
                    {item.layer}
                  </Text>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.detail ? (
                    <Text style={styles.resultDetail} numberOfLines={1}>
                      {item.detail}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevronRight" size={18} color="#8aa0b1" />
              </Pressable>
            )}
            ItemSeparatorComponent={Separator}
            ListFooterComponent={
              totalCount > results.length
                ? () => (
                    <Text style={styles.footerText}>
                      {t('header.showingFirst', { count: results.length })}
                    </Text>
                  )
                : undefined
            }
          />
        </>
      ) : (
        <Text style={styles.hintText}>{t('header.searchPlaceholder')}</Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#f8fafc',
    paddingHorizontal: SPACING.md,
  },
  input: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },
  cancelButton: { paddingHorizontal: 4, paddingVertical: 8 },
  cancelText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  resultsHeaderText: { fontSize: 10, color: COLORS.textFaint },
  list: { flexGrow: 0 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  resultDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  resultBody: { flex: 1, minWidth: 0 },
  resultLayer: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.textFaint,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  resultDetail: { fontSize: 11, color: COLORS.textFaint, marginTop: 2 },
  separator: { height: 1, backgroundColor: '#edf1f5', marginLeft: SPACING.lg },
  emptyText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textFaint,
    paddingVertical: SPACING.xl,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.textFaint,
    paddingVertical: SPACING.sm,
  },
  hintText: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    fontSize: 12,
    color: COLORS.textFaint,
    textAlign: 'center',
  },
});
