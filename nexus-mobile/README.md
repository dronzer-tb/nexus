# Nexus Monitor — Android App

Remote metrics display for the [Nexus](https://github.com/dronzer-tb/nexus) monitoring platform.

## Features

- **Real-time dashboard** — View all registered nodes with live CPU, RAM, and disk metrics
- **Node details** — Tap any node for full breakdown: memory (active vs cached), disks, network, system info, processes
- **API key authentication** — Securely connect using API keys generated from the Nexus dashboard
- **Auto-refresh** — Metrics update every 5 seconds
- **Pull-to-refresh** — Manual refresh on any screen
- **Dark theme** — Matches Nexus dashboard's synthwave/brutalist aesthetic

## Setup

### 1. Generate an API Key

1. Open the Nexus dashboard in your browser
2. Go to **Settings → API Keys**
3. Click **"New Key"** and name it (e.g. "My Phone")
4. Copy the generated key (starts with `nxk_`)

### 2. Configure the App

1. Open the app → **Settings** tab
2. Enter your **Server URL** (e.g. `http://192.168.1.100:8080`)
3. Paste your **API Key**
4. Tap **"Test Connection"** to verify
5. Tap **"Save"**

## Development

```bash
cd nexus-mobile
npm install
npx expo start
```

Scan the QR code with Expo Go on your Android device, or press `a` to open in an Android emulator.

## Build APK

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build Android APK
eas build --platform android --profile preview
```

Or for a local dev build:
```bash
npx expo run:android
```

## Tech Stack

- **React Native** (Expo SDK 54)
- **React Navigation** (bottom tabs + stack)
- **Expo SecureStore** (encrypted credential storage)
- **Axios** (HTTP client)
