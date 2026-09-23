import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en, zh } from "./locales";

let ready = false;

export function setupI18n(lang: "zh" | "en" = "zh") {
  if (ready) {
    void i18n.changeLanguage(lang);
    return i18n;
  }
  void i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: lang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
  ready = true;
  return i18n;
}

export { i18n };
