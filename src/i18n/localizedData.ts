import type { SupportedLanguage } from './index';

type DataRecord = Record<string, unknown>;
export type LocalizedDataValue = { value: string; isFallback: boolean };

function clean(value: unknown): string {
  if (value === null || value === undefined) return '';
  const result = String(value).trim();
  return result.toLowerCase() === 'null' ? '' : result;
}

/** Đọc trường `field_en` hoặc `translations.en.field`, sau đó dự phòng bằng tiếng Việt. */
export function getLocalizedDataValue(
  properties: DataRecord,
  fieldNames: string[],
  language: SupportedLanguage,
): LocalizedDataValue {
  if (language !== 'vi') {
    const translations = properties.translations;
    const languageRecord =
      translations && typeof translations === 'object'
        ? (translations as Record<string, unknown>)[language]
        : undefined;
    for (const field of fieldNames) {
      const suffixedValue = clean(properties[`${field}_${language}`]);
      if (suffixedValue) return { value: suffixedValue, isFallback: false };
      if (languageRecord && typeof languageRecord === 'object') {
        const nestedValue = clean((languageRecord as DataRecord)[field]);
        if (nestedValue) return { value: nestedValue, isFallback: false };
      }
    }
  }
  for (const field of fieldNames) {
    const value = clean(properties[field]);
    if (value) return { value, isFallback: language !== 'vi' };
  }
  return { value: '', isFallback: false };
}

export function appLanguage(
  language: string | null | undefined,
): SupportedLanguage {
  const shortCode = (language ?? 'vi').split('-')[0] as SupportedLanguage;
  return ['vi', 'en', 'fr', 'ja', 'ko', 'zh'].includes(shortCode)
    ? shortCode
    : 'vi';
}
