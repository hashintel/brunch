// The "brunch" wordmark for the TUI header: a big lowercase figlet (Slant),
// tinted top-to-bottom with a warm orange theme (the kind of sunset gradient
// CLI tools tend to use). Generated once with figlet (no runtime dep). The
// plain/CI backend stays untinted and prints no banner.

export const BRUNCH_ASCII: readonly string[] = [
  '    __                          __  ',
  '   / /_  _______  ______  _____/ /_ ',
  '  / __ \\/ ___/ / / / __ \\/ ___/ __ \\',
  ' / /_/ / /  / /_/ / / / / /__/ / / /',
  '/_.___/_/   \\__,_/_/ /_/\\___/_/ /_/ ',
];

// One shade per row, light amber → deep ember.
export const BRUNCH_ORANGE: readonly string[] = ['#FFB454', '#FFA033', '#FF8C1A', '#FF7A00', '#F26419'];
