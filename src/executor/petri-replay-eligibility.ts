export function canProjectPetriReplay(args: {
  readonly petriNet: unknown;
  readonly petriEvents: {
    readonly exists: boolean;
    readonly torn: boolean;
    readonly total: number;
  };
}): boolean {
  return (
    args.petriNet !== undefined &&
    args.petriEvents.exists &&
    args.petriEvents.total > 0 &&
    !args.petriEvents.torn
  );
}
