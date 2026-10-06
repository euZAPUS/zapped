import { c42Phrases, c42Words } from './c42';
import { cyberPhrases, cyberWords } from './cyber';
import { en } from './en';
import { es } from './es';

export type LangId = 'es' | 'en' | 'cyber' | 'c42';

export interface WordList {
  id: LangId;
  label: string;
  words: string[];
  /** Multi-word snippets that are inserted as a unit now and then. */
  phrases: string[];
}

export const LANGUAGES: Record<LangId, WordList> = {
  es: { id: 'es', label: 'Español', words: es, phrases: [] },
  en: { id: 'en', label: 'English', words: en, phrases: [] },
  cyber: { id: 'cyber', label: 'Ciberseguridad', words: cyberWords, phrases: cyberPhrases },
  c42: { id: 'c42', label: 'C · 42', words: c42Words, phrases: c42Phrases },
};

export const LANGUAGE_IDS = Object.keys(LANGUAGES) as LangId[];
