export function canProjectPetriReplay(args: {
  readonly petriNet: unknown;
  readonly petriEvents: {
    readonly exists: boolean;
    readonly torn: boolean;
  };
}): boolean {
  return args.petriNet !== undefined && args.petriEvents.exists && !args.petriEvents.torn;
}
