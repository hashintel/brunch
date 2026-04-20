'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import type { ComponentProps, CSSProperties, HTMLAttributes } from 'react';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  createPlainCodeTokens,
  getCachedHighlightedCode,
  highlightCode,
  preloadRichCodeHighlighter,
  type CodeLanguage,
  type CodeToken,
  type TokenizedCode,
} from '@/client/capabilities/code-highlighting';
import { Button } from '@/client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { cn } from '@/client/lib/utils';

// Shiki encodes font styles as bitflags: 1=italic, 2=bold, 4=underline
/* oxlint-disable eslint(no-bitwise) -- shiki bitflag decoding */
const isItalic = (fontStyle: number | undefined) => fontStyle && fontStyle & 1;
const isBold = (fontStyle: number | undefined) => fontStyle && fontStyle & 2;
const isUnderline = (fontStyle: number | undefined) => fontStyle && fontStyle & 4;
/* oxlint-enable eslint(no-bitwise) */

// Transform tokens to include pre-computed keys to avoid noArrayIndexKey lint
interface KeyedToken {
  token: CodeToken;
  key: string;
}
interface KeyedLine {
  tokens: KeyedToken[];
  key: string;
}

const addKeysToTokens = (lines: CodeToken[][]): KeyedLine[] =>
  lines.map((line, lineIdx) => ({
    key: `line-${lineIdx}`,
    tokens: line.map((token, tokenIdx) => ({
      key: `line-${lineIdx}-${tokenIdx}`,
      token,
    })),
  }));

// Token rendering component
const TokenSpan = ({ token }: { token: CodeToken }) => (
  <span
    className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]"
    style={
      {
        backgroundColor: token.bgColor,
        color: token.color,
        fontStyle: isItalic(token.fontStyle) ? 'italic' : undefined,
        fontWeight: isBold(token.fontStyle) ? 'bold' : undefined,
        textDecoration: isUnderline(token.fontStyle) ? 'underline' : undefined,
        ...token.htmlStyle,
      } as CSSProperties
    }
  >
    {token.content}
  </span>
);

// Line number styles using CSS counters
const LINE_NUMBER_CLASSES = cn(
  'block',
  'before:content-[counter(line)]',
  'before:inline-block',
  'before:[counter-increment:line]',
  'before:w-8',
  'before:mr-4',
  'before:text-right',
  'before:text-muted-foreground/50',
  'before:font-mono',
  'before:select-none',
);

// Line rendering component
const LineSpan = ({ keyedLine, showLineNumbers }: { keyedLine: KeyedLine; showLineNumbers: boolean }) => (
  <span className={showLineNumbers ? LINE_NUMBER_CLASSES : 'block'}>
    {keyedLine.tokens.length === 0
      ? '\n'
      : keyedLine.tokens.map(({ token, key }) => <TokenSpan key={key} token={token} />)}
  </span>
);

// Types
type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: CodeLanguage;
  showLineNumbers?: boolean;
};

interface CodeBlockContextType {
  code: string;
}

// Context
const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
});

const CodeBlockBody = memo(
  ({
    tokenized,
    showLineNumbers,
    className,
  }: {
    tokenized: TokenizedCode;
    showLineNumbers: boolean;
    className?: string;
  }) => {
    const preStyle = useMemo(
      () => ({
        backgroundColor: tokenized.bg,
        color: tokenized.fg,
      }),
      [tokenized.bg, tokenized.fg],
    );

    const keyedLines = useMemo(() => addKeysToTokens(tokenized.tokens), [tokenized.tokens]);

    return (
      <pre
        className={cn(
          'm-0 p-4 text-sm dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]',
          className,
        )}
        style={preStyle}
      >
        <code
          className={cn(
            'font-mono text-sm',
            showLineNumbers && '[counter-increment:line_0] [counter-reset:line]',
          )}
        >
          {keyedLines.map((keyedLine) => (
            <LineSpan key={keyedLine.key} keyedLine={keyedLine} showLineNumbers={showLineNumbers} />
          ))}
        </code>
      </pre>
    );
  },
  (prevProps, nextProps) =>
    prevProps.tokenized === nextProps.tokenized &&
    prevProps.showLineNumbers === nextProps.showLineNumbers &&
    prevProps.className === nextProps.className,
);

CodeBlockBody.displayName = 'CodeBlockBody';

export const CodeBlockContainer = ({
  className,
  language,
  onFocusCapture,
  onPointerEnter,
  onTouchStart,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { language: string }) => {
  const warmHighlighter = useCallback(() => {
    void preloadRichCodeHighlighter();
  }, []);

  return (
    <div
      className={cn(
        'group relative w-full overflow-hidden rounded-md border bg-background text-foreground',
        className,
      )}
      data-language={language}
      onFocusCapture={(event) => {
        warmHighlighter();
        onFocusCapture?.(event);
      }}
      onPointerEnter={(event) => {
        warmHighlighter();
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        warmHighlighter();
        onTouchStart?.(event);
      }}
      style={{
        containIntrinsicSize: 'auto 200px',
        contentVisibility: 'auto',
        ...style,
      }}
      {...props}
    />
  );
};

export const CodeBlockHeader = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex items-center justify-between border-b bg-muted/80 px-3 py-2 text-xs text-muted-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const CodeBlockTitle = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2', className)} {...props}>
    {children}
  </div>
);

export const CodeBlockFilename = ({ children, className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('font-mono', className)} {...props}>
    {children}
  </span>
);

export const CodeBlockActions = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('-my-1 -mr-1 flex items-center gap-2', className)} {...props}>
    {children}
  </div>
);

export const CodeBlockContent = ({
  code,
  language,
  showLineNumbers = false,
}: {
  code: string;
  language: CodeLanguage;
  showLineNumbers?: boolean;
}) => {
  const rawTokens = useMemo(() => createPlainCodeTokens(code), [code]);
  const cachedTokens = useMemo(() => getCachedHighlightedCode(code, language), [code, language]);
  const [asyncTokens, setAsyncTokens] = useState<TokenizedCode | null>(cachedTokens);

  useEffect(() => {
    let cancelled = false;

    setAsyncTokens(cachedTokens);

    if (cachedTokens) {
      return;
    }

    void highlightCode(code, language)
      .then((result) => {
        if (!cancelled) {
          setAsyncTokens(result);
        }
      })
      .catch((error) => {
        console.error('Failed to highlight code:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [cachedTokens, code, language]);

  const tokenized = asyncTokens ?? rawTokens;

  return (
    <div className="relative overflow-auto">
      <CodeBlockBody showLineNumbers={showLineNumbers} tokenized={tokenized} />
    </div>
  );
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const contextValue = useMemo(() => ({ code }), [code]);

  return (
    <CodeBlockContext.Provider value={contextValue}>
      <CodeBlockContainer className={className} language={language} {...props}>
        {children}
        <CodeBlockContent code={code} language={language} showLineNumbers={showLineNumbers} />
      </CodeBlockContainer>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      onError?.(new Error('Clipboard API not available'));
      return;
    }

    try {
      if (!isCopied) {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        onCopy?.();
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
          setIsCopied(false);
          timeoutRef.current = null;
        }, timeout);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [code, onCopy, onError, timeout, isCopied]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    },
    [],
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn('shrink-0', className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};

export type CodeBlockLanguageSelectorProps = ComponentProps<typeof Select>;

export const CodeBlockLanguageSelector = (props: CodeBlockLanguageSelectorProps) => <Select {...props} />;

export type CodeBlockLanguageSelectorTriggerProps = ComponentProps<typeof SelectTrigger>;

export const CodeBlockLanguageSelectorTrigger = ({
  className,
  ...props
}: CodeBlockLanguageSelectorTriggerProps) => (
  <SelectTrigger
    className={cn('h-7 border-none bg-transparent px-2 text-xs shadow-none', className)}
    size="sm"
    {...props}
  />
);

export type CodeBlockLanguageSelectorValueProps = ComponentProps<typeof SelectValue>;

export const CodeBlockLanguageSelectorValue = (props: CodeBlockLanguageSelectorValueProps) => (
  <SelectValue {...props} />
);

export type CodeBlockLanguageSelectorContentProps = ComponentProps<typeof SelectContent>;

export const CodeBlockLanguageSelectorContent = ({
  align = 'end',
  ...props
}: CodeBlockLanguageSelectorContentProps) => <SelectContent align={align} {...props} />;

export type CodeBlockLanguageSelectorItemProps = ComponentProps<typeof SelectItem>;

export const CodeBlockLanguageSelectorItem = (props: CodeBlockLanguageSelectorItemProps) => (
  <SelectItem {...props} />
);
