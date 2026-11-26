import { en } from "./en";
import { hi } from "./hi";

export type { Messages } from "./en";
export type Locale = "en" | "hi";

export const messages = { en, hi };
export const formatLocales: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN",
};
