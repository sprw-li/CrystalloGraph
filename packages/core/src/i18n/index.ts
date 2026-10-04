import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en, zh, type LocaleDict } from "./locales";

/**
 * Single source of truth for UI language.
 *
 * - String tables live in `./locales.ts` (one typed dictionary per language).
 * - Shells (web / desktop) never hold their own text; they only render `AppShell`.
 * - Initial language: saved choice → system/browser locale → English fallback.
 * - The choice is persisted in localStorage (not in the `.cgraph` document).
 */

export type Lang = "zh" | "en";

/** Language options shown in the (single) language switch, in their own names. */
export const SUPPORTED_LANGS: ReadonlyArray<{ id: Lang; nativeName: string; bcp47: string }> = [
  { id: "zh", nativeName: "中文", bcp47: "zh-CN" },
  { id: "en", nativeName: "English", bcp47: "en" },
];

export const FALLBACK_LANG: Lang = "en";
const STORAGE_KEY = "cgraph.lang";

const resources = {
  zh: { translation: zh },
  en: { translation: en },
} as const;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: LocaleDict };
    keySeparator: false;
  }
}

function isLang(v: unknown): v is Lang {
  return SUPPORTED_LANGS.some((l) => l.id === v);
}

/** Map a BCP-47 tag (e.g. "zh-Hans-CN", "en-GB") to a supported language. */
export function matchLang(tag: string | null | undefined): Lang | null {
  if (!tag) return null;
  const primary = tag.toLowerCase().split(/[-_]/)[0];
  return isLang(primary) ? primary : null;
}

function readSaved(): Lang | null {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

function writeSaved(lang: Lang) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable (private mode etc.) — choice lasts for this session */
  }
}

/** Saved choice, else first supported entry of the system/browser locale list, else English. */
export function detectInitialLang(): Lang {
  const saved = readSaved();
  if (saved) return saved;
  const nav = globalThis.navigator;
  const tags = nav ? [...(nav.languages ?? []), nav.language] : [];
  for (const tag of tags) {
    const m = matchLang(tag);
    if (m) return m;
  }
  return FALLBACK_LANG;
}

function applyDocumentLang(lang: Lang) {
  if (typeof document === "undefined") return;
  const meta = SUPPORTED_LANGS.find((l) => l.id === lang);
  document.documentElement.lang = meta?.bcp47 ?? lang;
}

let ready = false;

/**
 * Initialise i18next once (idempotent). Called automatically on import;
 * passing `lang` switches language without persisting it.
 */
export function setupI18n(lang?: Lang) {
  if (!ready) {
    const initial = lang ?? detectInitialLang();
    void i18n.use(initReactI18next).init({
      resources,
      lng: initial,
      fallbackLng: FALLBACK_LANG,
      supportedLngs: SUPPORTED_LANGS.map((l) => l.id),
      keySeparator: false,
      interpolation: { escapeValue: false },
      initAsync: false,
      returnNull: false,
      showSupportNotice: false,
    });
    i18n.on("languageChanged", (l) => {
      if (isLang(l)) applyDocumentLang(l);
    });
    applyDocumentLang(initial);
    ready = true;
  } else if (lang && i18n.language !== lang) {
    void i18n.changeLanguage(lang);
  }
  return i18n;
}

/** Current UI language. */
export function currentLang(): Lang {
  setupI18n();
  return isLang(i18n.language) ? i18n.language : FALLBACK_LANG;
}

/** Switch UI language and remember the choice. */
export function changeLang(lang: Lang) {
  setupI18n();
  writeSaved(lang);
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

setupI18n();

export { i18n };
