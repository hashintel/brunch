import { useEffect, useRef, useState } from 'react';

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
 * Hard cap on automatic retries per `(specificationId, parentChatId)` pair.
 * After this many failed `create` attempts the shell stops auto-retrying so a
 * down server cannot trigger a hot fetch loop; the user can recover via a
 * deliberate refresh or navigation that changes the bootstrap deps.
 */
const MAX_AUTO_RETRY_ATTEMPTS = 3;

/**
 * Auto-create the master (empty) secondary chat on a fresh spec so the shell
 * surfaces a usable composer + turn-zero suggestions instead of an empty
 * placeholder.
 *
 * Concurrency latch: `inFlightKeyRef` holds the `(specificationId,parentChatId)`
 * key of the in-flight create so a render that re-fires the effect before the
 * promise settles cannot issue a duplicate `POST /secondary-chats`. The
 * mutation object lives in a ref because `useCreateMasterChatMutation` returns
 * a fresh object every render.
 *
 * Retry: `create` resolves to `null` on a network or server error. To recover
 * without waiting for `hasMaster`/`parentChatId`/`specificationId` to change,
 * each failure bumps `retryAttempt` state (capped at `MAX_AUTO_RETRY_ATTEMPTS`),
 * which is itself an effect dep and so re-runs the bootstrap with the same
 * key. The attempt counter resets when the pair changes.
 */
export function useMasterChatBootstrap({
  specificationId,
  parentChatId,
  hasMaster,
}: UseMasterChatBootstrapInput): void {
  const masterMutation = useCreateMasterChatMutation(specificationId);
  const masterMutationRef = useRef(masterMutation);
  masterMutationRef.current = masterMutation;

  // Set on every attempt; cleared only after a failed `create` so renders
  // during a successful in-flight call (and after success, until `hasMaster`
  // flips) do not re-fire the POST.
  const attemptedKeyRef = useRef<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasMaster || parentChatId === null) return;
    const key = `${specificationId}:${parentChatId}`;
    // Fresh `(specId,parentChatId)` pair → reset retry budget and the latch.
    if (retryKeyRef.current !== key) {
      retryKeyRef.current = key;
      attemptedKeyRef.current = null;
      if (retryAttempt !== 0) {
        setRetryAttempt(0);
        return;
      }
    }
    if (attemptedKeyRef.current === key) return;
    if (retryAttempt >= MAX_AUTO_RETRY_ATTEMPTS) return;
    attemptedKeyRef.current = key;
    void masterMutationRef.current.create({ parentChatId }).then((result) => {
      if (result === null && attemptedKeyRef.current === key) {
        // Release the latch and bump retryAttempt to re-run this effect even
        // when the parent re-renders with the same deps.
        attemptedKeyRef.current = null;
        setRetryAttempt((prev) => (prev >= MAX_AUTO_RETRY_ATTEMPTS ? prev : prev + 1));
      }
    });
  }, [hasMaster, parentChatId, retryAttempt, specificationId]);
}
