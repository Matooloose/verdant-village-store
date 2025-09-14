import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.129e63c9901d44aeb6a767b4aa20f07d',
  appName: 'verdant-village-store',
  webDir: 'dist',
  server: {
    url: 'https://129e63c9-901d-44ae-b6a7-67b4aa20f07d.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#4ade80",
      showSpinner: false
    }
  }
};

export default config;