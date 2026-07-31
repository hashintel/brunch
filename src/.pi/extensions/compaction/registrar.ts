import { compact, type ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { compactionAnchorContract } from './anchor-contract.js';
import {
  BRUNCH_COMPACTION_BLOCK_SCHEMA_VERSION,
  renderBrunchContinuityBlock,
  stripBrunchContinuityBlock,
} from './continuity-block.js';
import { selectCompactionAnchors } from './select-anchors.js';

/**
 * Compose Brunch's continuity contract with Pi's public native compaction.
 * Pi retains cut-point, split-turn, narrative, token, and file-operation ownership.
 */
export function registerBrunchCompaction(pi: ExtensionAPI): void {
  pi.on('session_before_compact', async (event, ctx) => {
    try {
      const { preparation } = event;
      if (!event.branchEntries.some((entry) => entry.id === preparation.firstKeptEntryId)) {
        throw new Error('Pi compaction cut boundary was not present on the current branch');
      }
      if (!ctx.model) throw new Error('No active model is available for compaction');

      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
      if (!auth.ok) throw new Error(`Compaction auth failed: ${auth.error}`);
      const provider = ctx.modelRegistry.getProvider(ctx.model.provider);
      if (!provider) throw new Error(`Compaction provider is unavailable: ${ctx.model.provider}`);

      const selected = selectCompactionAnchors(
        event.branchEntries,
        preparation.firstKeptEntryId,
        compactionAnchorContract,
      );
      const continuityBlock = renderBrunchContinuityBlock(selected);
      const previousSummary = stripBrunchContinuityBlock(preparation.previousSummary);
      const native = await compact(
        { ...preparation, ...(previousSummary === undefined ? {} : { previousSummary }) },
        ctx.model,
        auth.apiKey,
        auth.headers,
        event.customInstructions,
        event.signal,
        pi.getThinkingLevel(),
        (model, context, options) => provider.streamSimple(model, context, options),
        auth.env,
      );

      if (!isNativeCompactionDetails(native.details)) {
        throw new Error('Native compaction details must contain string readFiles and modifiedFiles arrays');
      }

      return {
        compaction: {
          ...native,
          summary: `${continuityBlock}\n${native.summary}`,
          details: {
            ...native.details,
            brunch: {
              compactionBlockSchemaVersion: BRUNCH_COMPACTION_BLOCK_SCHEMA_VERSION,
              anchorContractVersion: compactionAnchorContract.version,
            },
          },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Brunch compaction failed: ${message}`, 'error');
      return { cancel: true };
    }
  });
}

function isNativeCompactionDetails(
  value: unknown,
): value is Record<string, unknown> & { readFiles: string[]; modifiedFiles: string[] } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const details = value as Record<string, unknown>;
  return isStringArray(details.readFiles) && isStringArray(details.modifiedFiles);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
