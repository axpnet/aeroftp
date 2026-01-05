# 🌍 AeroFTP Internationalization (i18n) Guide

This document explains how to add new translations to AeroFTP.

## Overview

AeroFTP uses a lightweight, custom i18n system built on React Context. It provides:
- **Zero dependencies** - No external i18n libraries
- **Type-safe translations** - Full TypeScript support with autocompletion
- **Browser detection** - Automatically detects user's preferred language
- **Persistence** - Language preference saved to localStorage
- **Fallback** - Falls back to English for missing translations
- **Parameter interpolation** - Supports dynamic values in strings

## Project Structure

```
src/i18n/
├── index.ts              # Public exports
├── I18nContext.tsx       # Provider & hooks
├── types.ts              # TypeScript interfaces
└── locales/
    ├── en.json           # English (base language)
    └── it.json           # Italian
```

## How to Add a New Language

### Step 1: Create the Translation File

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/{code}.json`
   - Use ISO 639-1 language codes (e.g., `de`, `fr`, `es`, `pt`, `zh`, `ja`)

2. Update the `meta` section:
   ```json
   {
     "meta": {
       "code": "de",
       "name": "German",
       "nativeName": "Deutsch",
       "direction": "ltr"
     },
     "translations": {
       // ... translate all keys
     }
   }
   ```

3. Translate all keys in the `translations` object

### Step 2: Register the Language

1. Open `src/i18n/types.ts`

2. Add the language code to the `Language` type:
   ```typescript
   export type Language = 'en' | 'it' | 'de';  // Add new code here
   ```

3. Add the language to `AVAILABLE_LANGUAGES`:
   ```typescript
   export const AVAILABLE_LANGUAGES: LanguageInfo[] = [
     { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
     { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
     { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },  // New
   ];
   ```

### Step 3: Import the Translation

1. Open `src/i18n/I18nContext.tsx`

2. Add the import:
   ```typescript
   import deTranslations from './locales/de.json';
   ```

3. Add to `TRANSLATIONS` map:
   ```typescript
   const TRANSLATIONS: Record<Language, { translations: TranslationKeys }> = {
     en: enTranslations as { translations: TranslationKeys },
     it: itTranslations as { translations: TranslationKeys },
     de: deTranslations as { translations: TranslationKeys },  // New
   };
   ```

### Step 4: Test

1. Run `npm run build` to check for TypeScript errors
2. Run `npm run dev` and test the language selector in Settings → Appearance

## Translation Keys Reference

Translations are organized by namespace:

| Namespace     | Description                                |
| ------------- | ------------------------------------------ |
| `common`      | Buttons, actions (Save, Cancel, Delete...) |
| `connection`  | Connection screen labels                   |
| `browser`     | File browser UI                            |
| `contextMenu` | Right-click menu items                     |
| `transfer`    | Transfer progress/queue                    |
| `settings`    | Settings panel                             |
| `devtools`    | DevTools panel                             |
| `cloud`       | AeroCloud sync                             |
| `statusBar`   | Status bar labels                          |
| `dialogs`     | Dialog titles                              |
| `toast`       | Toast notifications                        |

## Using Parameter Interpolation

Translations can include dynamic values using `{paramName}` syntax:

**Translation file:**
```json
"toast": {
  "connectionSuccess": "Connected to {server}",
  "syncComplete": "Sync complete: ↑{uploaded} ↓{downloaded}"
}
```

**Usage in component:**
```typescript
const { t } = useI18n();
t('toast.connectionSuccess', { server: 'ftp.example.com' });
// Output: "Connected to ftp.example.com"

t('toast.syncComplete', { uploaded: 5, downloaded: 3 });
// Output: "Sync complete: ↑5 ↓3"
```

## Using Translations in Components

### Import the hook
```typescript
import { useI18n } from '../i18n';
// or
import { useTranslation } from '../i18n';
```

### Use in component
```typescript
const MyComponent: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  // or just: const t = useTranslation();
  
  return (
    <div>
      <h1>{t('common.settings')}</h1>
      <button onClick={() => setLanguage('it')}>
        {t('common.save')}
      </button>
    </div>
  );
};
```

## Best Practices

1. **Always use English as base** - Translate from `en.json`
2. **Keep keys organized** - Use namespaces consistently
3. **Test all edge cases** - Long strings, special characters, plurals
4. **Handle RTL if needed** - Set `direction: "rtl"` for Arabic, Hebrew, etc.
5. **Use native names** - Show "Deutsch" not "German" in selector

## Character Encoding

All translation files must be saved as **UTF-8** to properly handle:
- Accented characters (é, ü, ñ, etc.)
- CJK characters (日本語, 中文, 한국어)
- RTL scripts (العربية, עברית)
- Special symbols (€, £, ¥, ©, ™)

## Available Languages

| Code | Language | Native Name | Status            |
| ---- | -------- | ----------- | ----------------- |
| `en` | English  | English     | ✅ Complete (Base) |
| `it` | Italian  | Italiano    | ✅ Complete        |

---

**Maintainer**: axpdev  
**Last Updated**: 2026-01-05
