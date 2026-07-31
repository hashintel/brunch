# `.fixtures/seeds/wisp-secure-drop/`

A session-derived, execution-ready product graph for **Wisp**, a branded
full-stack encrypted file-drop application. The canonical fixture name is
`wisp-secure-drop`; the application itself remains Wisp.

Source: Brunch session `019faf5a-360b-73a4-acb0-e7d8b6e67f57`, originally
exported from the retained graph at LSN 34, then refined through LSN 8 in
session `019fb753-1115-77cb-b6cb-c3dcd804fb7a`. The reusable seed snapshot
preserves the accepted graph history, including superseded decisions, while
normalizing accepted items to the explicit basis required by the fixture
loader.

`base.json` is the canonical complete snapshot. Loading
`wisp-secure-drop/base` includes the whole graph; no additions, variants, or
flags need to be selected separately. A sibling execution-ready messenger
fixture lives at [`../nullwire/README.md`](../nullwire/README.md), built from
the same spec-to-graph pattern with its own accountless E2EE room contract.

The Wisp snapshot's settled state includes:

- Vite dev-server proxying for origin-relative `/drops` requests
- browser-generated UUID v4 drop ids available before AAD encryption, with
  server validation and collision rejection
- Vitest as the concrete `npm test` runner, with real-Web-Crypto and jsdom
  component-test boundaries made explicit
- an injectable backend clock plus in-process API, request-recorder, plaintext
  sentinel, and client outbound-request verification harnesses
- the Wisp product name
- a shared secure-terminal shell across sender and recipient routes, with
  command-style workflows, local security events, and an accessible status strip
- axe-core accessibility checks, exact clipboard assertions, and an explicit
  interaction-state contract for distinct UI states
- the complete crypto, backend, UI, plan, and verification graph history,
  including superseded planning history

The snapshot contains 88 nodes and 210 edges.

Validate with:

```sh
npx tsx src/graph/validate-fixture.ts wisp-secure-drop/base
```

## Product requirements

This README is the human-readable product source for the fixture. `base.json`
is the executable graph snapshot consumed by Brunch. Material product changes
must update both surfaces in the same change.

### Summary

Wisp is a self-contained local application for sharing one encrypted file and
an optional short note through a capability link. The sender's browser encrypts
before upload. The recipient's browser decrypts after retrieval. The service
stores ciphertext and operational metadata but never receives plaintext
content, plaintext notes, or decryption-key material.

### Product goals

- Make the browser/server security boundary visible and deterministically
  testable.
- Let a sender share one file and optional note through one recipient link.
- Recover the byte-identical file and exact note when the capability is valid.
- Support expiry and independent revocation without giving the recipient
  revocation authority.
- Present the workflow through a keyboard-first secure-terminal interface.
- Run locally from one npm repository without external runtime services.

### Non-goals

- Accounts, identity, contacts, conversations, presence, or notifications
- Multiple files, folders, streaming encryption, or resumable upload
- Search, collaboration, editing, or recipient read state
- Protection from compromised sender or recipient devices
- Traffic-analysis resistance or sophisticated denial-of-service defense
- Formal cryptographic certification or custom cryptographic primitives
- Cloud deployment or external runtime services

### Sender journey

1. The sender selects one file of at most 10 MB and may enter a short note.
2. Before encryption, the browser generates a UUID v4 drop id with
   `crypto.randomUUID()` and selects the expiry timestamp.
3. The browser generates a 256-bit AES-GCM key and 12-byte nonce with Web
   Crypto.
4. It serializes the note and file into one bundle and encrypts it with the drop
   id, filename, MIME type, file size, and expiry timestamp as authenticated
   additional data.
5. One `POST /drops` sends the client-generated id, ciphertext, nonce, and
   plaintext operational metadata. It never sends the plaintext bundle or key.
6. The server validates and stores the id unchanged, creates a separate
   revocation capability, and returns the same id plus the raw revocation token.
7. The browser displays a recipient link containing the decryption key only in
   the URL fragment and a separate revocation link.

### Recipient and revocation journeys

1. The recipient opens `/d/:dropId#<key>`.
2. The browser reads the id from the path and key from the fragment. Fragments
   are never included in HTTP requests.
3. It fetches ciphertext, nonce, and authenticated metadata from
   `GET /drops/:dropId`.
4. It reconstructs the deterministic AAD and decrypts locally.
5. On success, the note renders as text and the file downloads through a Blob
   URL under its sanitized original filename.
6. Wrong or missing keys, tampered ciphertext or metadata, expiry, and
   revocation reveal no partial plaintext.
7. The sender can revoke with the separate revocation capability. Recipient
   links cannot derive or exercise revocation authority.

### Interface design

Wisp uses one dark, monospace secure-terminal shell on sender and recipient
routes:

- green-on-near-black palette, subtle terminal borders, and prompt-style labels
- timestamped local events for key generation, encryption, capability recovery,
  retrieval, authentication, decryption, expiry, and revocation
- persistent status strip explaining the active security and lifecycle state
- command-styled file, note, expiry, create-drop, download, and revoke actions
- cryptographic state presented as status, never as editable low-level controls

All actions are keyboard operable with visible focus. Status changes use
non-disruptive live announcements. Color is not the only state indicator.
Filenames and notes render as text, and revocation requires explicit
confirmation.

### Trust model

Protected against:

- an honest-but-curious service or storage operator
- accidental server-side disclosure and database or log inspection
- guessed drop identifiers without the fragment capability
- malformed clients and stored-content injection
- ciphertext, nonce, or authenticated-metadata tampering
- server-side substitution of metadata bound into AAD

Not protected against:

- a compromised sender or recipient browser or operating system
- a participant intentionally disclosing plaintext or capability material
- observation of traffic timing, sizes, or endpoint metadata
- denial of service beyond the explicit upload ceiling

### Cryptographic envelope

- Encryption: AES-256-GCM through Web Crypto
- Key generation: `SubtleCrypto.generateKey`
- Nonce generation: 12 random bytes from `crypto.getRandomValues`
- Drop id generation: browser-side UUID v4 before encryption
- Key transport: base64url value in the recipient URL fragment
- AAD, in fixed deterministic order: drop id, filename, MIME type, file size,
  expiry timestamp
- Plaintext bundle: 4-byte big-endian note-length prefix, UTF-8 note bytes, then
  original file bytes

The server validates canonical UUID v4 syntax and primary-key uniqueness but
never replaces the id. A malformed id returns `400`; a collision returns `409`
without changing the existing row. Any authentication failure clears
intermediate plaintext and produces one generic recipient error.

### API contract

`POST /drops`

- Body: `{ dropId, ciphertext, nonce, filename, mimeType, fileSize, expiresAt }`
- `201`: `{ dropId, revocationToken }`
- `400`: malformed body or non-canonical/non-v4 id
- `409`: id already exists
- `413`: upload exceeds 10 MB

`GET /drops/:id`

- `200`: ciphertext, nonce, filename, MIME type, file size, and expiry
- `404` or `410`: missing, expired, or revoked

`DELETE /drops/:id`

- Body: `{ revocationToken }`
- `204`: revoked
- `401`: token mismatch
- `404`: missing drop

### Persistence and lifecycle

SQLite stores the opaque id, ciphertext, nonce, authenticated operational
metadata, creation and expiry timestamps, revocation state, and
`SHA-256(revocationToken)`. The raw revocation token is returned once and never
persisted. The default lifetime is 24 hours and is enforced server-side. Expired
or revoked drops consistently stop returning ciphertext.

No table, request log, application log, or error payload may contain plaintext
file bytes, plaintext notes, decryption keys, or recoverable equivalents.

### Architecture and commands

One npm repository contains:

- React and TypeScript frontend built with Vite and CSS Modules
- Node.js and TypeScript backend using Express
- SQLite persistence through `better-sqlite3`
- Vitest as the single test runner; `npm test` runs `vitest --run`
- Supertest for Express integration tests

`npm run dev` starts Vite and Express through `concurrently`. Vite proxies
origin-relative `/drops` requests to the backend. `npm run build` produces the
complete runnable application, and `npm start` serves the built frontend and
API from Express.

### Failure semantics

- Malformed ids and bodies do not create rows.
- Duplicate ids return `409` and do not replace existing ciphertext.
- Oversized requests return `413` before persistence.
- Wrong revocation capabilities do not change state.
- Expired and revoked drops never return ciphertext.
- Wrong keys and modified ciphertext, nonce, or any AAD field render no partial
  note or file.
- Path-like filenames cannot select server filesystem paths.
- Uploaded HTML downloads as an attachment and does not execute in the
  application origin.

### Verification

Vitest owns the authored `npm test` command:

- Crypto-envelope tests use real Node Web Crypto for byte-identical round trips,
  wrong-key rejection, and independent tampering of ciphertext, nonce, and every
  AAD field.
- React component tests run in jsdom with a narrow fake crypto adapter so
  cross-realm `ArrayBuffer` behavior cannot masquerade as cryptographic
  evidence.
- Express and SQLite integration tests use Supertest, a controlled clock, UUID
  validation, collision attempts, expiry, revocation, size limits, and filename
  hardening.
- A server-side request recorder proves what reached the service, while a client
  outbound-request spy independently proves application code never attempted to
  transmit fragment key material.
- End-to-end tests prove that the same client-generated id appears in the POST
  body, stored row, response, share link, and decrypted AAD.
- Unique plaintext sentinels are searched across captured requests, SQLite,
  logs, errors, and persisted server state; any server-side match fails the
  suite.
- UI verification combines axe-core scans with exact clipboard writes and
  per-state contract assertions; visual taste remains a human judgment.
- A development-path check proves browser requests through Vite reach Express
  rather than returning a Vite `404`.
- `npm run build` must succeed from a clean checkout without ambient files.

### Implementation sequence

1. Crypto envelope and deterministic AAD, backed by real-Web-Crypto Vitest
   vectors.
2. Express and SQLite core with client-id validation, expiry, revocation, and
   integration tests.
3. Combined sender and recipient journeys inside the shared secure-terminal
   shell, with mocked crypto at the component boundary.
4. End-to-end security witness, sentinel scanning, development proxy proof, and
   clean build verification.

The graph retains superseded intermediate scopes as history, but active
implementation should follow the consolidated sequence above.
