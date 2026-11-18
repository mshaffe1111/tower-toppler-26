# Towering Waters: Gateway's Descent — Google Play Store & Capacitor Android Packaging Guide

**Application ID:** `com.mattshaffer.toweringwaters`  
**App Name:** `Towering Waters: Gateway's Descent`  
**Author:** Matt Shaffer  
**Target SDK / WebView:** Android API 35 (Android 15) · Chromium System WebView `>= 108` (WebGL 2.0 + ES Import Maps)

---

## 1. 100% Offline Bundle Architecture

*Towering Waters: Gateway's Descent* ships as a self-contained offline HTML5 + WebGL 2.0 bundle with **zero external runtime network requests**:

- **3D Engine (`vendor/three/`):** `three@0.170.0` (`vendor/three/build/three.module.min.js` + `vendor/three/examples/jsm/**`), mapped via `<script type="importmap">` in `index.html`.
- **Typography (`assets/fonts/`):** Local SIL Open Font License 1.1 `.woff2` fonts (`Cinzel`, `Outfit`, `Plus Jakarta Sans`, `Rajdhani`, `Orbitron`) served via `assets/fonts/fonts.css` (`assets/fonts/OFL.txt` bundled).
- **3D Models & PBR Maps (`assets/models/`, `assets/textures/`):** Self-contained binary `.glb` assets (`gateway.glb` 34-bone `SkinnedMesh`, `real_staircase.glb`, `mech_elevator.glb`, `hydro_turbine.glb`, `pipe_valve.glb`, and 7 articulated enemy `.glb` rigs).
- **Studio Audio (`assets/audio/`):** Offline `.ogg` music stems and stereo biome water soundscapes (`< 10 MB` total).
- **Payload Budget:** Total runtime bundle (`index.html`, `styles.css`, `manifest.webmanifest`, `src/`, `vendor/`, `assets/`) stays sleek (`< 75 MB`), well inside Google Play's `200 MB` base module limit without Play Asset Delivery splits.

---

## 2. Capacitor Android Setup & Release `.aab` Build

`capacitor.config.json` is pre-configured at the repository root with `appId: "com.mattshaffer.toweringwaters"`, `https` local scheme, `allowMixedContent: false`, immersive splash/status-bar overlays, and `.aab` release output.

```bash
# 1. Install Capacitor Android packages (when building native Android project)
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/android @capacitor/app @capacitor/status-bar @capacitor/splash-screen

# 2. Initialize & sync the Android platform wrapper
npx cap add android
npx cap sync android

# 3. Open in Android Studio to sign & build the Google Play Android App Bundle (.aab)
npx cap open android
```

### Recommended `AndroidManifest.xml` Immersive Game Flags
Inside `android/app/src/main/AndroidManifest.xml` on `<activity android:name=".MainActivity">`:
- `android:hardwareAccelerated="true"`
- `android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"`
- `android:windowLayoutInDisplayCutoutMode="shortEdges"` (via `styles.xml` fullscreen immersive theme)
- `<uses-feature android:glEsVersion="0x00030000" android:required="true" />` (WebGL 2.0 / OpenGL ES 3.0)

---

## 3. Google Play Pre-Launch Checklist

- [x] **Zero External CDNs:** Verified in Airplane Mode (`--host-resolver-rules=MAP * ~NOTFOUND`) — `0` external DNS/HTTP requests and `0` missing local `404`s.
- [x] **Hardware Back-Button Compliance:** Pressing Android Back closes active overlays or toggles the Pause modal cleanly instead of abruptly terminating the activity.
- [x] **Responsive Safe-Area & Viewport Matrix:** Tested across `360×800`, `412×915` (Pixel Portrait), `915×412` (Ultra-Wide Landscape), `1024×768` (Tablet), and `1920×1080` (Desktop/Chromebook).
- [x] **100% Clean Original IP:** Original world, characters, 3D rigs, shaders, and acoustic score created for *Towering Waters: Gateway's Descent*.
