import { useEffect, useState } from 'react';

import type { KnowledgeKind } from '@/shared/knowledge.js';

export interface TextSelectionAnchor {
  kind: KnowledgeKind;
  itemId: number;
  referenceCode: string;
}

export interface ActiveTextSelection {
  snapshot: string;
  start: number;
  end: number;
  rect: DOMRect;
  anchor: TextSelectionAnchor;
}

function readAnchor(element: Element): TextSelectionAnchor | null {
  const kindAttr = element.getAttribute('data-item-kind');
  const itemIdAttr = element.getAttribute('data-item-id');
  const refAttr = element.getAttribute('data-graph-row-ref');
  if (!kindAttr || !itemIdAttr || !refAttr) return null;
  const itemId = Number(itemIdAttr);
  if (Number.isNaN(itemId)) return null;
  return {
    kind: kindAttr as KnowledgeKind,
    itemId,
    referenceCode: refAttr,
  };
}

function findAnnotatableHost(node: Node | null, selector: string): Element | null {
  let cursor: Node | null = node;
  while (cursor && cursor.nodeType !== Node.ELEMENT_NODE) {
    cursor = cursor.parentNode;
  }
  return (cursor as Element | null)?.closest(selector) ?? null;
}

export function useTextSelection(scopeSelector: string): ActiveTextSelection | null {
  const [active, setActive] = useState<ActiveTextSelection | null>(null);

  useEffect(() => {
    function handleSelectionChange(): void {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setActive(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const startHost = findAnnotatableHost(range.startContainer, scopeSelector);
      const endHost = findAnnotatableHost(range.endContainer, scopeSelector);
      if (!startHost || startHost !== endHost) {
        setActive(null);
        return;
      }
      const snapshot = range.toString();
      if (snapshot.trim().length === 0) {
        setActive(null);
        return;
      }
      const text = startHost.textContent ?? '';
      const start = text.indexOf(snapshot);
      if (start === -1) {
        setActive(null);
        return;
      }
      const end = start + snapshot.length;
      // Look up the anchor: try the host element itself, then walk up to data-graph-row.
      const row = startHost.closest('[data-graph-row]');
      const anchor = readAnchor(startHost) ?? (row ? readAnchor(row) : null);
      if (!anchor) {
        setActive(null);
        return;
      }
      setActive({
        snapshot,
        start,
        end,
        rect: range.getBoundingClientRect(),
        anchor,
      });
    }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [scopeSelector]);

  return active;
}
