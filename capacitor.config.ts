import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.farmersbracket.app',
  appName: 'farmersbracket',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'https://sandbox.payfast.co.za',
      'https://www.payfast.co.za',
      'https://paying-project.onrender.com'
    ]
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