import { useEffect, useRef } from 'react';

import { useCreateMasterChatMutation } from './secondary-chat-trigger.js';

export interface UseMasterChatBootstrapInput {
  /** Specification whose primary chat should host the auto-created master. */
  readonly specificationId: number;
  /** Parent (primary) chat id; null while the bundle has not resolved one. */
  readonly parentChatId: number | null;
  /** True when a master secondary chat already exists for the spec. */
  readonly hasMaster: boolean;
}

/**
 * Auto-create the master (empty) secondary chat on a fresh spec so the shell
 * surfaces a usable composer + turn-zero suggestions instead of an empty
 * placeholder.
 *
 * The latch is keyed on `(specificationId, parentChatId)` and lives in a ref
 * so an in-flight create followed by bundle invalidation does not issue
 * duplicate `POST /secondary-chats`. The mutation object is also held in a
 * ref because `useCreateMasterChatMutation` returns a fresh object every
 * render — pinning it in the effect's dep array would re-fire between
 * in-flight creates and the bundle refresh that flips `hasMaster` true.
 *
 * `create` returns null on network or server error. Releasing the latch on
 * failure lets a subsequent render — e.g. bundle refresh, route navigation —
 * retry instead of stranding the shell on an empty "Opening chat…" state
 * until full remount.
 */
export function useMasterChatBootstrap({
  specificationId,
  parentChatId,
  hasMaster,
}: UseMasterChatBootstrapInput): void {
  const masterMutation = useCreateMasterChatMutation(specificationId);
  const masterMutationRef = useRef(masterMutation);
  masterMutationRef.current = masterMutation;

  const masterCreateAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasMaster || parentChatId === null) return;
    const key = `${specificationId}:${parentChatId}`;
    if (masterCreateAttemptedRef.current === key) return;
    masterCreateAttemptedRef.current = key;
    void masterMutationRef.current.create({ parentChatId }).then((result) => {
      if (result === null && masterCreateAttemptedRef.current === key) {
        masterCreateAttemptedRef.current = null;
      }
    });
  }, [hasMaster, parentChatId, specificationId]);
}
