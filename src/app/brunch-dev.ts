export function isBrunchDevEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BRUNCH_DEV === '1';
}
