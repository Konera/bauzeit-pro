// Language Context: Stellt die aktuelle Sprache und t()-Funktion bereit
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { translations, type Language, type TranslationKey, languageNames } from './translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
  languageNames: typeof languageNames
  availableLanguages: Language[]
}

const LanguageContext = createContext<LanguageContextType | null>(null)

const STORAGE_KEY = 'bauzeit_language'

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && (stored === 'de' || stored === 'en' || stored === 'ru')) {
      return stored as Language
    }
    // Browser-Sprache erkennen
    const browserLang = navigator.language.slice(0, 2).toLowerCase()
    if (browserLang === 'ru') return 'ru'
    if (browserLang === 'en') return 'en'
    return 'de'
  } catch {
    return 'de'
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Ignore storage errors
    }
  }, [])

  const t = useCallback((key: TranslationKey): string => {
    return translations[language][key] || translations.de[key] || key
  }, [language])

  // HTML lang-Attribut setzen
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languageNames,
        availableLanguages: ['de', 'en', 'ru'],
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

/**
 * Hook für Übersetzungen
 * Verwendung: const { t, language, setLanguage } = useTranslation()
 */
export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation muss innerhalb von LanguageProvider verwendet werden')
  }
  return context
}

export default LanguageProvider
