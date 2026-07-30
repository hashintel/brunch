# Secure Drop

## Objective and opening request

The operator wants a review-ready product specification for a small full-stack application that lets one person share one encrypted file, with an optional short note, through a capability link.

Open naturally with:

> We want to build Secure Drop, a small application for sharing an encrypted file and optional note through a link. Help me work through the product, security, and technical decisions and produce a review-ready specification for the full-stack application.

## Product context and priorities

A sender chooses one file and may add a short note. The browser encrypts both before upload. The service stores the encrypted payload and returns a share link that the sender can give to a recipient. A recipient with a valid link can recover the original file and note in the browser.

The first priority is a legible end-to-end security boundary: the service must not receive or persist plaintext file content, plaintext notes, or decryption-key material. The second priority is a bounded, useful workflow that can be built and verified deterministically.

## Constraints and known facts

- The implementation is one npm repository with a React and TypeScript frontend, a Node.js and TypeScript backend, and SQLite persistence.
- The application runs locally for the demo. Dependency installation may use the package registry, but the running application and its tests use no external services or runtime network beyond the local frontend/backend.
- Encryption and decryption happen in the browser with the platform Web Crypto API and authenticated encryption. The implementation must not invent cryptographic primitives or use `Math.random` for security material.
- The decryption capability stays in the URL fragment so browsers do not send it to the server in HTTP requests. The server receives only an opaque drop identifier and encrypted material.
- The server stores ciphertext and the minimum operational metadata needed for retrieval, expiry, revocation, and safe download. It must not store plaintext file content, plaintext notes, decryption keys, or recoverable equivalents.
- The sender receives both a recipient share link and a separate revocation capability. Revocation authority must not be derivable from the recipient link.
- Every drop has a server-enforced expiry. Once expired or revoked, later retrieval fails consistently.
- The recipient must receive a byte-identical file and exact note when the capability is valid. A wrong or missing capability, tampered ciphertext, nonce, or authenticated metadata must fail closed without exposing partial plaintext or corrupting stored state.
- Filenames and notes render as text rather than executable markup. Downloads must not execute uploaded HTML in the application origin. Path-like filenames must not control server filesystem paths.
- The first version handles one file per drop in browser memory. Streaming, folders, accounts, identity, search, conversations, delivery state, presence, notifications, and real-time synchronization are out of scope.
- The threat model covers an honest-but-curious service/storage operator, accidental server-side disclosure, guessed identifiers, malformed clients, and stored content injection. Compromised sender/recipient devices, traffic-analysis resistance, denial-of-service resistance beyond simple size limits, and formal cryptographic certification are out of scope.
- Comparison and local development use deterministic fixture files, a controlled clock where expiry is tested, and unique plaintext sentinels that can be searched across captured requests, SQLite, logs, reports, and persisted server state.
- The repository must provide `npm test` and `npm run build`. The build must produce the complete runnable application without relying on controller-repository files or ambient dependencies.

## Uncertainties

The operator has not chosen the React build tool, Node server framework, SQLite library or ORM, router, CSS approach, exact API shape, encrypted envelope schema, upload size ceiling, default expiry duration, download confirmation interaction, or error-copy details.

The specification conversation should decide whether ciphertext is represented as one envelope or separate file/note fields, which metadata is authenticated, how revocation capabilities are stored safely, and how the local demo starts both frontend and backend. It should also identify frontend, backend, cryptographic-envelope, and end-to-end verification boundaries that can be implemented independently where dependencies permit.

When information is absent or remains undecided, record it as unknown rather than inventing evidence or silently weakening the security boundary.

## Decision latitude

Ask about consequential user-flow, threat-model, retention, expiry, revocation, malformed-input, and verification choices. Explain meaningful tradeoffs and recommend one coherent minimal direction.

The operator may accept sensible library and interaction recommendations within the fixed stack. Low-consequence visual details may be left to implementation. Do not broaden the product into messaging or collaboration, weaken the ciphertext-only service boundary, or claim security properties outside the stated threat model.

## Conversational and disclosure posture

Answer directly from the facts above, but do not volunteer them as a requirements dump before the target asks focused questions. Let consequential details emerge through the conversation. Become decisive once a recommendation is clear, preserve explicit uncertainty where it is not, and reject scope expansion that would make the demo less bounded or deterministic.

## Requested document

Ask for the completed specification to be written as `secure-drop-spec.md`. It should be review-ready for a product and implementation team and cover:

- sender and recipient journeys;
- scope and explicit non-goals;
- threat model and trust boundaries;
- encryption, capability, expiry, revocation, and failure semantics;
- frontend/backend ownership and data flow;
- accessible UI and API behavior;
- deterministic acceptance criteria and V&V methods;
- independently buildable slices and their dependencies; and
- the authored setup, test, and build commands required to execute the project from a clean repository.

The document is ready when a planner can derive an executable multi-slice implementation without inventing security requirements, hidden dependencies, or verification authority.
