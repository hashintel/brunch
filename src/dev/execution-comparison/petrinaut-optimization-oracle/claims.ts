export type PetrinautFocusedObservation =
  | {
      readonly check: 'route-and-accessibility';
      readonly pathname: string;
      readonly expectedPathname: string;
      readonly controlsReachable: boolean;
    }
  | {
      readonly check: 'progress-and-completion';
      readonly progressiveTrialCount: number;
      readonly bestSoFarVisible: boolean;
      readonly completionVisible: boolean;
    }
  | {
      readonly check: 'cancel-and-abort';
      readonly cancelControlVisible: boolean;
      readonly cancelledVisible: boolean;
      readonly hostRequestAborted: boolean;
    }
  | {
      readonly check: 'private-origin-secrecy';
      readonly candidateOrigin: string;
      readonly browserRequestUrls: readonly string[];
      readonly domText: string;
      readonly privateOrigin: string;
    };

export function assessPetrinautFocusedObservation(
  observation: PetrinautFocusedObservation,
): readonly string[] {
  switch (observation.check) {
    case 'route-and-accessibility':
      return [
        ...(observation.pathname === observation.expectedPathname ? [] : ['focused route missing']),
        ...(observation.controlsReachable ? [] : ['required controls are not keyboard reachable']),
      ];
    case 'progress-and-completion':
      return [
        ...(observation.progressiveTrialCount > 0 ? [] : ['progressive trials missing']),
        ...(observation.bestSoFarVisible ? [] : ['best-so-far missing']),
        ...(observation.completionVisible ? [] : ['completion missing']),
      ];
    case 'cancel-and-abort':
      return [
        ...(observation.cancelControlVisible ? [] : ['cancel control missing']),
        ...(observation.cancelledVisible ? [] : ['cancelled state missing']),
        ...(observation.hostRequestAborted ? [] : ['host request was not aborted']),
      ];
    case 'private-origin-secrecy':
      return [
        ...(observation.browserRequestUrls.every((url) => new URL(url).origin === observation.candidateOrigin)
          ? []
          : ['browser contacted private origin']),
        ...(observation.domText.includes(observation.privateOrigin) ? ['DOM exposed private origin'] : []),
      ];
  }
}

export function requirePetrinautFocusedObservation(observation: PetrinautFocusedObservation): void {
  const failures = assessPetrinautFocusedObservation(observation);
  if (failures.length > 0) throw new Error(failures.join('; '));
}
