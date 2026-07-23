export interface ManagedJourneyResult<Context> {
  readonly status: 'passed' | 'setup_failed' | 'assertion_failed';
  readonly message: string;
  readonly context?: Context;
}

export async function runManagedProspectJourney<Context>(input: {
  readonly open: () => Promise<Context>;
  readonly setup: (context: Context) => Promise<void>;
  readonly assert: (context: Context) => Promise<void>;
  readonly close: (context: Context) => Promise<void>;
  readonly timeoutMs: number;
}): Promise<ManagedJourneyResult<Context>> {
  let context: Context | undefined;
  let status: ManagedJourneyResult<Context>['status'] = 'passed';
  let message = 'all independent assertions passed';
  try {
    context = await input.open();
    try {
      await withTimeout(input.setup(context), input.timeoutMs, 'journey setup timed out');
    } catch (error) {
      status = 'setup_failed';
      message = errorMessage(error);
    }
    if (status === 'passed') {
      try {
        await withTimeout(input.assert(context), input.timeoutMs, 'journey assertion timed out');
      } catch (error) {
        status = 'assertion_failed';
        message = errorMessage(error);
      }
    }
  } catch (error) {
    status = 'setup_failed';
    message = errorMessage(error);
  } finally {
    if (context !== undefined) {
      try {
        await input.close(context);
      } catch (error) {
        status = 'setup_failed';
        message = `${message}; cleanup failed: ${errorMessage(error)}`;
      }
    }
  }
  return { status, message, ...(context === undefined ? {} : { context }) };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
