'use client';

import type { BundledLanguage, BundledTheme, HighlighterGeneric, ThemedToken } from 'shiki';
import { createHighlighter } from 'shiki';

export type CodeLanguage = BundledLanguage;
export type CodeToken = ThemedToken;

export interface TokenizedCode {
  tokens: CodeToken[][];
  fg: string;
  bg: string;
}

const highlighterCache = new Map<string, Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>>();
const tokensCache = new Map<string, TokenizedCode>();
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

const getTokensCacheKey = (code: string, language: CodeLanguage) => {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : '';
  return `${language}:${code.length}:${start}:${end}`;
};

const getHighlighter = (
  language: CodeLanguage,
): Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> => {
  const cached = highlighterCache.get(language);
  if (cached) {
    return cached;
  }

  const highlighterPromise = createHighlighter({
    langs: [language],
    themes: ['github-light', 'github-dark'],
  });

  highlighterCache.set(language, highlighterPromise);
  return highlighterPromise;
};

export const createPlainCodeTokens = (code: string): TokenizedCode => ({
  bg: 'transparent',
  fg: 'inherit',
  tokens: code.split('\n').map((line) =>
    line === ''
      ? []
      : [
          {
            color: 'inherit',
            content: line,
          } as CodeToken,
        ],
  ),
});

export const highlightCode = (
  code: string,
  language: CodeLanguage,
  callback?: (result: TokenizedCode) => void,
): TokenizedCode | null => {
  const tokensCacheKey = getTokensCacheKey(code, language);

  const cached = tokensCache.get(tokensCacheKey);
  if (cached) {
    return cached;
  }

  if (callback) {
    if (!subscribers.has(tokensCacheKey)) {
      subscribers.set(tokensCacheKey, new Set());
    }
    subscribers.get(tokensCacheKey)?.add(callback);
  }

  getHighlighter(language)
    .then((highlighter) => {
      const availableLangs = highlighter.getLoadedLanguages();
      const langToUse = availableLangs.includes(language) ? language : 'text';

      const result = highlighter.codeToTokens(code, {
        lang: langToUse,
        themes: {
          dark: 'github-dark',
          light: 'github-light',
        },
      });

      const tokenized: TokenizedCode = {
        bg: result.bg ?? 'transparent',
        fg: result.fg ?? 'inherit',
        tokens: result.tokens,
      };

      tokensCache.set(tokensCacheKey, tokenized);

      const pendingSubscribers = subscribers.get(tokensCacheKey);
      if (pendingSubscribers) {
        for (const subscriber of pendingSubscribers) {
          subscriber(tokenized);
        }
        subscribers.delete(tokensCacheKey);
      }
    })
    .catch((error) => {
      console.error('Failed to highlight code:', error);
      subscribers.delete(tokensCacheKey);
    });

  return null;
};
