'use client';

import type { BundledLanguage, ThemedToken } from 'shiki';

export type CodeLanguage = BundledLanguage;
export type CodeToken = ThemedToken;

export interface TokenizedCode {
  tokens: CodeToken[][];
  fg: string;
  bg: string;
}

const tokensCache = new Map<string, TokenizedCode>();
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();
let richCodeHighlighterPromise: Promise<typeof import('./rich-code-highlighting').highlightCodeRich> | null =
  null;

const getTokensCacheKey = (code: string, language: CodeLanguage) => {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : '';
  return `${language}:${code.length}:${start}:${end}`;
};

const loadRichCodeHighlighter = () => {
  if (!richCodeHighlighterPromise) {
    richCodeHighlighterPromise = import('./rich-code-highlighting.js').then(
      (module) => module.highlightCodeRich,
    );
  }

  return richCodeHighlighterPromise;
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

  void loadRichCodeHighlighter()
    .then((highlightCodeRich) => highlightCodeRich(code, language))
    .then((tokenized) => {
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
