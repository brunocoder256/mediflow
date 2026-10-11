import en from "./dictionaries/en";
import { dictionaries } from "./dictionaries";
import { DEFAULT_LANGUAGE, normalizeLanguage } from "./config";

export type TranslateVars = Record<string, string | number>;
export type Translator = (key: string, vars?: TranslateVars) => string;

/** Resolve a dot-path key from a nested dictionary object. */
function getValue(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

/** Replace `{name}` placeholders with values from `vars`. */
function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

/**
 * Build a translator bound to a language. Missing keys fall back to English;
 * a key that is missing everywhere returns the key itself so nothing silently
 * disappears.
 */
export function createTranslator(language: string): Translator {
  const code = normalizeLanguage(language);
  const dict = (dictionaries[code] ?? dictionaries[DEFAULT_LANGUAGE]) as unknown;
  return function t(key: string, vars?: TranslateVars): string {
    const value = getValue(dict, key) ?? getValue(en, key);
    if (value === undefined) return key;
    return interpolate(value, vars);
  };
}
