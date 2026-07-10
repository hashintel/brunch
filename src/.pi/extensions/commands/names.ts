export const BRUNCH_COMMAND_PREFIX = 'brunch:';
export const BRUNCH_MENU_COMMAND = 'brunch:menu';
export const BRUNCH_CONSULT_COMMAND = 'brunch:consult';
export const BRUNCH_CONTINUE_COMMAND = 'brunch:continue';
export const BRUNCH_MODE_COMMAND = 'brunch:mode';

export function slashCommand(command: string): `/${string}` {
  return `/${command}`;
}
