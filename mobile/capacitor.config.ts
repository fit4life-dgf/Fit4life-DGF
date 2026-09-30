import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'in.fit4life.app',
  appName: 'FIT4LIFE',
  // The web app is built to ../dist and bundled inside the app.
  webDir: '../dist',
  android: { allowMixedContent: false },
  ios: { contentInset: 'always' },
}

export default config
