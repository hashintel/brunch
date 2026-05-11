import type { PluginOption } from 'vite';

const reactScanVersion = '0.5.6';

// React Scan stores its widget corner under `react-scan-widget-settings-v2`
// and its runtime options (notably `enabled`) under `react-scan-options`. We
// seed both before the auto-global script runs so the toolbar starts in the
// lower-left corner and is inactive by default. We only seed when the keys
// are absent so user toggles persist across reloads.
const reactScanSeedScript = `
(function () {
  try {
    var widgetKey = 'react-scan-widget-settings-v2';
    if (!localStorage.getItem(widgetKey)) {
      localStorage.setItem(widgetKey, JSON.stringify({ corner: 'bottom-left' }));
    }
    var optionsKey = 'react-scan-options';
    if (!localStorage.getItem(optionsKey)) {
      localStorage.setItem(optionsKey, JSON.stringify({ enabled: false }));
    }
  } catch (_) {}
})();
`;

export const reactScanDevPlugin = (): PluginOption => ({
  name: 'brunch:react-scan-dev',
  apply: 'serve',
  transformIndexHtml() {
    return [
      {
        tag: 'script',
        children: reactScanSeedScript,
        injectTo: 'head-prepend',
      },
      {
        tag: 'script',
        attrs: {
          crossorigin: 'anonymous',
          src: `https://unpkg.com/react-scan@${reactScanVersion}/dist/auto.global.js`,
        },
        injectTo: 'head-prepend',
      },
    ];
  },
});
