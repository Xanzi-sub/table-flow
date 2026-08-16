import type { CapacitorConfig } from "@capacitor/cli";

const appOrigin = process.env.TABLEFLOW_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
const appUrl = appOrigin ? `${appOrigin.replace(/\/$/, "")}/staff/login` : undefined;

const config: CapacitorConfig = {
  // Replace this placeholder with your registered reverse-domain identifier
  // before publishing to Google Play or the App Store.
  appId: process.env.TABLEFLOW_APP_ID ?? "com.example.tableflow",
  appName: "TableFlow",
  webDir: "capacitor-shell",
  server: appUrl
    ? {
        url: appUrl,
        cleartext: appUrl.startsWith("http://"),
        androidScheme: "https",
      }
    : undefined,
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0c3327ff",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#0c3327ff",
    },
  },
};

export default config;
