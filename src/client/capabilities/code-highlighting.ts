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
const inFlightHighlights = new Map<string, Promise<TokenizedCode>>();
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

export const preloadRichCodeHighlighter = () => loadRichCodeHighlighter();

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

export const getCachedHighlightedCode = (code: string, language: CodeLanguage): TokenizedCode | null => {
  const tokensCacheKey = getTokensCacheKey(code, language);
  return tokensCache.get(tokensCacheKey) ?? null;
};

export const highlightCode = async (code: string, language: CodeLanguage): Promise<TokenizedCode> => {
  const tokensCacheKey = getTokensCacheKey(code, language);
  const cached = tokensCache.get(tokensCacheKey);

  if (cached) {
    return cached;
  }

  const existingRequest = inFlightHighlights.get(tokensCacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = loadRichCodeHighlighter()
    .then((highlightCodeRich) => highlightCodeRich(code, language))
    .then((tokenized) => {
      tokensCache.set(tokensCacheKey, tokenized);
      inFlightHighlights.delete(tokensCacheKey);
      return tokenized;
    })
    .catch((error) => {
      inFlightHighlights.delete(tokensCacheKey);
      throw error;
    });

  inFlightHighlights.set(tokensCacheKey, request);
  return request;
};
