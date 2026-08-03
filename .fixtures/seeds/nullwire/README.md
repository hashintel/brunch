# Nullwire fixture and design source

This directory is the canonical source for **Nullwire**, a self-contained local
full-stack demo for accountless, end-to-end encrypted, two-person messaging.
`base.json` materializes this design as settled explicit-basis intent, design,
oracle, and plan truth.

Loading `nullwire/base` includes the complete graph; no additions or flags need
to be selected separately. The snapshot contains 61 nodes and 143 edges. Its
greenfield execution projection is plan-ready with no findings.

## Product contract

A creator opens a room and shares one single-use invite. One peer claims it,
after which both browsers exchange authenticated encrypted text in real time
and recover encrypted history after reconnecting.

The server coordinates room lifecycle and ciphertext delivery but cannot derive
message keys or decrypt content. The first version deliberately does not claim
forward secrecy, post-compromise recovery, malicious-server handshake
resistance, verified identity, or multi-device support.

### Goals

- Keep the browser-to-browser plaintext boundary legible and testable.
- Support one useful asynchronous conversation without accounts or external
  runtime services.
- Fail closed on invalid invites, tampering, replay, expiry, and revocation.
- Provide a keyboard-first secure-terminal interface without exposing
  cryptographic machinery as user-configurable controls.
- Produce deterministic evidence from two isolated browser contexts, captured
  transport, SQLite, logs, and persisted server state.

### Non-goals

- Groups, reusable invitations, or more than two participants
- Accounts, contacts, recovery, or multi-device synchronization
- Attachments, reactions, replies, editing, search, or read receipts
- Signal Protocol, forward secrecy, or post-compromise recovery
- Protection from compromised participant devices or an active malicious
  handshake server
- Traffic-analysis resistance, metadata hiding, federation, push
  notifications, or cloud deployment

## User journeys

### Create

1. The creator sees a fixed two-person, single-use, 24-hour room boundary.
2. The browser generates the creator keypair and independent invite, access,
   and revocation capabilities.
3. Private and raw capability material remains in IndexedDB; the server
   receives only the public key and capability hashes.
4. The UI presents a copyable invite and waits for one peer.

### Claim

1. The peer opens
   `/join/:roomId?f=<creatorFingerprint>#i=<inviteCapability>`.
2. The browser fetches the creator public key and verifies its SHA-256
   fingerprint before enabling claim.
3. The peer browser generates its keypair and access capability.
4. The server atomically consumes the invite and registers the peer public key
   and access-capability hash. Every later claimant fails.
5. Both browsers derive matching directional message keys independently.

### Exchange and resume

1. The sender validates and encrypts text before transport.
2. The server validates envelope metadata, commits ciphertext, and then fans it
   out over WebSocket.
3. The receiving browser acknowledges the envelope. `delivered` means browser
   receipt, not read receipt.
4. Reconnecting clients fetch ordered ciphertext after a cursor, decrypt
   locally, deduplicate by message id, and then resume live delivery.

### Expire and revoke

- Every room expires exactly 24 hours after creation.
- The creator may revoke earlier with a separate capability.
- Expiry or revocation closes active sockets and rejects later claim, history,
  and send operations consistently.
- Ciphertext may be deleted in the same transaction.

## Architecture

One npm repository contains:

- React, TypeScript, Vite, React Router, and ordinary CSS
- Node.js, TypeScript, Express, and `ws`
- SQLite through `better-sqlite3`
- browser cryptography through Web Crypto only

Vite proxies `/api` and `/ws` during development. One authored development
command starts both processes; the built application is served by Node from one
origin.

### Client boundaries

- `room-vault` owns IndexedDB private keys, raw capabilities, and receive
  cursors.
- `handshake` owns key generation/import, fingerprint verification, peer claim
  inputs, and directional key derivation.
- `envelope-codec` owns deterministic authenticated metadata, encryption,
  decryption, schema validation, and replay checks.
- `room-client` owns HTTP lifecycle calls, first-frame WebSocket
  authentication, catch-up, reconnect, acknowledgements, and deduplication.
- Route UI owns create, claim, active-room, closed-room, and unrecoverable-key
  presentation without manipulating key material directly.

### Server boundaries

- `room-service` owns create, atomic claim, authorization, expiry, and
  revocation.
- `message-store` owns ciphertext ordering, uniqueness, cursor reads, and
  delivery timestamps.
- `room-socket` owns first-frame authentication, commit-before-fan-out,
  acknowledgements, and lifecycle closure.
- HTTP and WebSocket adapters validate all untrusted input before calling these
  services.

## Trust model

Protected against:

- an honest-but-curious service or storage operator;
- accidental server-side disclosure and database or log inspection;
- guessed room identifiers without a capability;
- malformed clients, invalid envelopes, replay, and duplicate delivery; and
- stored content injection.

Not protected against:

- active server key substitution;
- an invite leaked before first claim;
- a compromised participant browser or operating system;
- participant disclosure of plaintext or key material; or
- metadata, timing, and message-length observation.

User-facing copy may say **end-to-end encrypted** and **the server cannot read
message content**. It must not claim anonymity, verified identity, forward
secrecy, or protection from a malicious service.

## Cryptographic protocol

### Primitives

- P-256 ECDH through Web Crypto
- HKDF-SHA-256
- AES-256-GCM
- `crypto.getRandomValues`
- SHA-256 fingerprints and domain-separated capability hashes

The implementation does not define custom cryptographic primitives.

### Room material

The creator generates a P-256 keypair and independent 32-byte invite,
creator-access, and revocation capabilities. It uploads canonical SPKI public
material and:

- `SHA-256("nullwire:invite:v1:" || inviteCapability)`
- `SHA-256("nullwire:access:v1:" || creatorAccessCapability)`
- `SHA-256("nullwire:revoke:v1:" || revocationCapability)`

The invite capability remains after `#` in the shared URL. The peer generates
its own P-256 keypair and 32-byte access capability. Its claim contains the raw
invite transiently, peer public key, and peer-access hash.

Both browsers compute the ECDH secret. HKDF uses
`SHA-256(inviteCapability)` as salt,
`nullwire/message-keys/v1/<roomId>` as info, and 64 output bytes. The first 32
bytes are the creator-to-peer key; the second 32 bytes are the peer-to-creator
key.

These are static room keys. Compromise of retained browser key material may
expose retained history, so Nullwire makes no forward-secrecy claim.

### Message envelope

Plaintext is a validated object:

```json
{ "type": "text", "text": "message content" }
```

Text contains 1–4,000 Unicode scalar values. The serialized encrypted envelope
may not exceed 16 KiB.

Each message has protocol version `1`, a random 128-bit id, fixed sender role,
next per-sender sequence, and random 96-bit nonce. AES-GCM additional data is
the UTF-8 encoding of:

```json
[1, "<roomId>", "<messageId>", "<senderRole>", "<sequence>"]
```

The server requires the next sender sequence and uniqueness for message id,
`(room, sender, sequence)`, and `(room, sender, nonce)`. The receiver
independently enforces authentication, schema, and replay rules before render.

## Public transport

HTTP surface:

- `POST /api/rooms`
- `GET /api/rooms/:roomId/handshake`
- `POST /api/rooms/:roomId/claim`
- `GET /api/rooms/:roomId/messages?after=<cursor>`
- `POST /api/rooms/:roomId/revoke`

Access and revocation capabilities use authorization headers rather than URLs.
The WebSocket connects at `/ws` and authenticates in the first client frame, so
credentials do not enter WebSocket URLs or access logs.

## Persistence

`rooms` stores the opaque room id, public keys, capability hashes, and created,
claimed, expires, and revoked timestamps.

`messages` stores message id, room id, sender role and sequence, nonce,
ciphertext, server receipt timestamp, and nullable delivered timestamp.

No table contains plaintext, ECDH private keys, derived AES keys, or raw
capabilities.

## Secure-terminal UI

Nullwire uses a dark monospace shell with three principal states:

1. **Create** — security boundary, fixed lifetime, create action, and local key
   generation.
2. **Claim** — creator fingerprint, single-use warning, claim action, and
   expiry.
3. **Active room** — encrypted status, sparse local events, terminal-form
   messages, keyboard-first composer, delivery state, countdown, and revoke.

All actions work by keyboard; focus is visible and intentional; lifecycle and
delivery changes use non-disruptive live announcements; color is not the only
status signal; revocation requires explicit confirmation; decrypted user
content renders as text; and failures reveal no partial plaintext.

## Failure semantics

- Missing, malformed, wrong, claimed, expired, or revoked invites create no
  local room state.
- A claim race has exactly one winner.
- Fingerprint mismatch stops before claim.
- Authentication or decrypted-schema failure renders nothing and does not
  advance the receive cursor.
- Duplicate ids and invalid sequences do not create duplicate messages.
- Network interruption leaves committed ciphertext available for catch-up.
- Missing IndexedDB key material is unrecoverable; the server cannot restore
  it.
- Logs contain opaque ids and safe codes only. Authorization and
  capability-bearing bodies are redacted.

## Verification

Unit and contract tests prove:

- matching directional key vectors through real Web Crypto;
- exact Unicode round trips;
- independent tamper failure for ciphertext, nonce, room, id, sender, and
  sequence;
- schema, size, and replay rejection;
- one-winner claim, authorization, expiry, and revocation under a controlled
  clock;
- ordering and uniqueness constraints; and
- socket authorization, commit-before-fan-out, acknowledgement, closure, and
  catch-up handoff.

UI component tests use a narrow fake crypto adapter; they are not accepted as
cryptographic evidence.

Two isolated real-browser contexts prove create, claim, bidirectional exchange,
offline catch-up, delivery acknowledgement, second-claim rejection, tamper
failure, controlled expiry/revocation, and keyboard/accessibility behavior.

Every run uses unique plaintext sentinels. The harness searches captured HTTP
and WebSocket payloads, SQLite, logs, errors, and persisted server files.
Finding plaintext on any server-side surface fails verification.

## Execution sequence

1. **Walking skeleton** — Vite shell, Express, WebSocket, SQLite, proxies,
   production serving, and two-browser connectivity.
2. **Cryptographic envelope** — vault, handshake, envelope codec, real Web
   Crypto vectors, replay, and tamper tests.
3. **Room lifecycle** — create, handshake, atomic claim, authorization, expiry,
   and revocation.
4. **Encrypted transport** — socket authorization, persistence, fan-out,
   acknowledgements, cursor catch-up, reconnect, and deduplication.
5. **Complete UI journeys** — create, claim, active room, reconnect, closure,
   unrecoverable-key, and accessible failure states.
6. **End-to-end security witness** — two real browsers, controlled clock,
   sentinel scanning, adversarial envelopes, clean commands, and final UI
   verification.

Each scope in `base.json` carries one or more design anchors, an acceptance
criterion, the project execution harness, and requirement-derived dependencies.

## Use and validation

Seed a workbench with:

```sh
npm run seed -- --seed nullwire/base --reset
```

Validate the graph with:

```sh
npx tsx src/graph/validate-fixture.ts nullwire/base
```
