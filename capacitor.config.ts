import type { CapacitorConfig } from '@capacitor/cli';
import '@capacitor-firebase/authentication';

const config: CapacitorConfig = {
  appId: 'br.com.runnex.app',
  appName: 'Runnex',
  webDir: 'dist',
  android: {
    useLegacyBridge: true,
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};  

export default config;
