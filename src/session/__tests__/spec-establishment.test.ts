import { describe, expect, it } from 'vitest';

import { decideSpecEstablishmentAsks, type SpecEstablishmentAsk } from '../spec-establishment.js';

const KIND_AND_ORIGIN: readonly SpecEstablishmentAsk[] = ['confirmKind', 'confirmOrigin'];
const ORIGIN_ONLY: readonly SpecEstablishmentAsk[] = ['confirmOrigin'];

describe('decideSpecEstablishmentAsks (D118-L deterministic establishment)', () => {
  it('no-specs/create, populated cwd: combined kind ask + brownfield confirm', () => {
    expect(decideSpecEstablishmentAsks({ currentOrigin: null, workspacePopulated: true })).toEqual(
      KIND_AND_ORIGIN,
    );
  });

  it('no-specs/create, bare cwd: greenfield confirm only (skip anything inferable)', () => {
    expect(decideSpecEstablishmentAsks({ currentOrigin: null, workspacePopulated: false })).toEqual(
      ORIGIN_ONLY,
    );
  });

  it('resume, posture already established: zero questions (never re-asked)', () => {
    expect(decideSpecEstablishmentAsks({ currentOrigin: 'brownfield', workspacePopulated: true })).toEqual(
      [],
    );
    expect(decideSpecEstablishmentAsks({ currentOrigin: 'greenfield', workspacePopulated: false })).toEqual(
      [],
    );
  });

  it('resume, posture-unestablished (e.g. created outside the dialog): asks once, same branching', () => {
    expect(decideSpecEstablishmentAsks({ currentOrigin: null, workspacePopulated: true })).toEqual(
      KIND_AND_ORIGIN,
    );
    expect(decideSpecEstablishmentAsks({ currentOrigin: null, workspacePopulated: false })).toEqual(
      ORIGIN_ONLY,
    );
  });

  it('new-spec-populated (other specs already exist): combined kind ask + brownfield confirm', () => {
    expect(decideSpecEstablishmentAsks({ currentOrigin: null, workspacePopulated: true })).toEqual(
      KIND_AND_ORIGIN,
    );
  });

  it('new-spec-bare (other specs already exist): greenfield confirm only', () => {
    expect(decideSpecEstablishmentAsks({ currentOrigin: null, workspacePopulated: false })).toEqual(
      ORIGIN_ONLY,
    );
  });
});
