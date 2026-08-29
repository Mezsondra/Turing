import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.turingtest.app',
  appName: 'Turing Test Challenge',
  // vite's output. The native app ships these assets inside the binary and
  // talks to the API over the network - it does not load the site remotely,
  // which Apple rejects under 4.2 as a "wrapper" app.
  webDir: 'dist',
};

export default config;
