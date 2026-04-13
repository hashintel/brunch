import { ThemeState, type GlobalProvider } from '@ladle/react';
import { useLayoutEffect } from 'react';

import './theme.css';

export const Provider: GlobalProvider = ({ children, globalState: { theme } }) => {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === ThemeState.Dark) {
      root.classList.add('dark');
    } else if (theme === ThemeState.Light) {
      root.classList.add('light');
    }
  }, [theme]);

  return children;
};
