// i18n Context Provider
// Lightweight React Context-based internationalization system

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
    Language,
    I18nContextValue,
    TranslationFunction,
    TranslationKeys,
    AVAILABLE_LANGUAGES,
    DEFAULT_LANGUAGE,
    LANGUAGE_STORAGE_KEY,
} from './types';

// Import translations statically for bundle optimization
// Using static imports ensures tree-shaking and type safety
import enTranslations from './locales/en.json';
import itTranslations from './locales/it.json';
import esTranslations from './locales/es.json';
import frTranslations from './locales/fr.json';
import zhTranslations from './locales/zh.json';

// Translation map for O(1) lookup
const TRANSLATIONS: Record<Language, { translations: TranslationKeys }> = {
    en: enTranslations as { translations: TranslationKeys },
    it: itTranslations as { translations: TranslationKeys },
    es: esTranslations as { translations: TranslationKeys },
    fr: frTranslations as { translations: TranslationKeys },
    zh: zhTranslations as { translations: TranslationKeys },
};

// Create context with undefined default (will throw if used outside provider)
const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/**
 * Get nested value from object using dot notation
 * Example: getNestedValue(obj, 'common.save') -> obj.common.save
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' ? current : undefined;
}

/**
 * Replace template parameters in translation string
 * Example: interpolate('Hello {name}!', { name: 'World' }) -> 'Hello World!'
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = params[key];
        return value !== undefined ? String(value) : match;
    });
}

/**
 * Detect browser language preference (DISABLED for developer-first approach)
 * Now returns default language - users must explicitly choose their language
 * This ensures consistent English default across all systems
 */
function detectBrowserLanguage(): Language {
    // Developer-first app: default to English, let users choose their preferred language
    return DEFAULT_LANGUAGE;
}

/**
 * Load persisted language preference from localStorage
 */
function loadPersistedLanguage(): Language | null {
    try {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored && AVAILABLE_LANGUAGES.some(l => l.code === stored)) {
            return stored as Language;
        }
    } catch {
        // localStorage not available (SSR or privacy mode)
    }
    return null;
}

/**
 * Persist language preference to localStorage
 */
function persistLanguage(language: Language): void {
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
        // Ignore storage errors
    }
}

/**
 * I18n Provider Props
 */
interface I18nProviderProps {
    children: React.ReactNode;
    initialLanguage?: Language;
}

/**
 * I18n Provider Component
 * Wraps the application and provides translation context
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({ children, initialLanguage }) => {
    // Initialize language: prop > localStorage > browser detection > default
    const [language, setLanguageState] = useState<Language>(() => {
        if (initialLanguage) return initialLanguage;
        return loadPersistedLanguage() || detectBrowserLanguage();
    });

    // Memoized translations for current language
    const translations = useMemo(() => {
        return TRANSLATIONS[language]?.translations || TRANSLATIONS[DEFAULT_LANGUAGE].translations;
    }, [language]);

    // Fallback translations (English) for missing keys
    const fallbackTranslations = useMemo(() => {
        return TRANSLATIONS[DEFAULT_LANGUAGE].translations;
    }, []);

    /**
     * Translation function
     * Supports dot notation: t('common.save')
     * Supports interpolation: t('toast.connectionSuccess', { server: 'ftp.example.com' })
     */
    const t: TranslationFunction = useCallback(
        (key: string, params?: Record<string, string | number>) => {
            // Try current language first
            let value = getNestedValue(translations as unknown as Record<string, unknown>, key);

            // Fallback to English if key not found
            if (value === undefined && language !== DEFAULT_LANGUAGE) {
                value = getNestedValue(fallbackTranslations as unknown as Record<string, unknown>, key);
            }

            // Return key if translation not found (helps identify missing translations)
            if (value === undefined) {
                console.warn(`[i18n] Missing translation: ${key}`);
                return key;
            }

            // Apply parameter interpolation
            return interpolate(value, params);
        },
        [translations, fallbackTranslations, language]
    );

    /**
     * Set language and persist preference
     */
    const setLanguage = useCallback((newLanguage: Language) => {
        if (!AVAILABLE_LANGUAGES.some(l => l.code === newLanguage)) {
            console.warn(`[i18n] Unsupported language: ${newLanguage}`);
            return;
        }

        setLanguageState(newLanguage);
        persistLanguage(newLanguage);

        // Emit custom event for components that need to react to language changes
        window.dispatchEvent(new CustomEvent('aeroftp-language-changed', { detail: newLanguage }));
    }, []);

    // Update document lang attribute for accessibility
    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo<I18nContextValue>(
        () => ({
            language,
            setLanguage,
            t,
            availableLanguages: AVAILABLE_LANGUAGES,
        }),
        [language, setLanguage, t]
    );

    return (
        <I18nContext.Provider value={contextValue}>
            {children}
        </I18nContext.Provider>
    );
};

/**
 * Hook to access i18n context
 * Must be used within an I18nProvider
 */
export function useI18n(): I18nContextValue {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
}

/**
 * Shorthand hook for translation function only
 * Use when you only need the t() function
 */
export function useTranslation(): TranslationFunction {
    const { t } = useI18n();
    return t;
}

export default I18nProvider;
