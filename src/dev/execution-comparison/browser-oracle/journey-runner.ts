export type JourneyStatus = 'passed' | 'setup_failed' | 'assertion_failed';

export interface IndependentJourney<Context> {
  readonly id: string;
  readonly claims: readonly string[];
  readonly setup: (context: Context) => Promise<void>;
  readonly assert: (context: Context) => Promise<void>;
}

export interface JourneyResult {
  readonly id: string;
  readonly claims: readonly string[];
  readonly status: JourneyStatus;
  readonly message: string;
}

export async function runIndependentJourneys<Context>(input: {
  readonly journeys: readonly IndependentJourney<Context>[];
  readonly open: (journey: IndependentJourney<Context>) => Promise<Context>;
  readonly close: (context: Context) => Promise<void>;
}): Promise<JourneyResult[]> {
  const results: JourneyResult[] = [];
  for (const journey of input.journeys) {
    let context: Context | undefined;
    let result: JourneyResult | undefined;
    try {
      context = await input.open(journey);
      try {
        await journey.setup(context);
      } catch (error) {
        result = failed(journey, 'setup_failed', error);
      }
      if (result === undefined) {
        try {
          await journey.assert(context);
          result = {
            id: journey.id,
            claims: journey.claims,
            status: 'passed',
            message: 'all assertions passed',
          };
        } catch (error) {
          result = failed(journey, 'assertion_failed', error);
        }
      }
    } catch (error) {
      result = failed(journey, 'setup_failed', error);
    } finally {
      if (context !== undefined) {
        try {
          await input.close(context);
        } catch (error) {
          const message = errorMessage(error);
          result = {
            id: journey.id,
            claims: journey.claims,
            status: 'setup_failed',
            message:
              result === undefined || result.status === 'passed'
                ? message
                : `${result.message}; teardown failed: ${message}`,
          };
        }
      }
    }
    results.push(result ?? failed(journey, 'setup_failed', 'journey produced no verdict'));
  }
  return results;
}

function failed<Context>(
  journey: IndependentJourney<Context>,
  status: Exclude<JourneyStatus, 'passed'>,
  error: unknown,
): JourneyResult {
  return {
    id: journey.id,
    claims: journey.claims,
    status,
    message: errorMessage(error),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
