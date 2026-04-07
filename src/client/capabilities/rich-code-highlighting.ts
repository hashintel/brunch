'use client';

import type { BundledTheme, HighlighterGeneric } from 'shiki';
import { createHighlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

import type { CodeLanguage, TokenizedCode } from './code-highlighting';

const regexEngine = createJavaScriptRegexEngine({ forgiving: true });
const highlighterCache = new Map<string, Promise<HighlighterGeneric<CodeLanguage, BundledTheme>>>();

const getHighlighter = (language: CodeLanguage): Promise<HighlighterGeneric<CodeLanguage, BundledTheme>> => {
  const cached = highlighterCache.get(language);
  if (cached) {
    return cached;
  }

  const highlighterPromise = createHighlighter({
    engine: regexEngine,
    langs: [language],
    themes: ['github-light', 'github-dark'],
  }) as Promise<HighlighterGeneric<CodeLanguage, BundledTheme>>;

  highlighterCache.set(language, highlighterPromise);
  return highlighterPromise;
};

export const highlightCodeRich = async (code: string, language: CodeLanguage): Promise<TokenizedCode> => {
  const highlighter = await getHighlighter(language);
  const availableLangs = highlighter.getLoadedLanguages();
  const langToUse = availableLangs.includes(language) ? language : 'text';

  const result = highlighter.codeToTokens(code, {
    lang: langToUse,
    themes: {
      dark: 'github-dark',
      light: 'github-light',
    },
  });

  return {
    bg: result.bg ?? 'transparent',
    fg: result.fg ?? 'inherit',
    tokens: result.tokens,
  };
};
