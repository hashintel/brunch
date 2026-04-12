import type { GlobalProvider } from '@ladle/react';

import '../src/client/index.css';

const THEME_KEY = 'brunch-ladle-theme';

export const Provider: GlobalProvider = ({ children }) => {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      {children}
    </div>
  );
};
