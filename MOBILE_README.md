# FIT4LIFE mobile (Android + iOS)

1. Create an empty private GitHub repo and push this whole folder to it (branch `main`).
2. Android: GitHub → Actions → "Build Android app" → Run workflow. Download `fit4life-debug-apk` and install it on your phone
   (allow "install unknown apps"). Open Profile → Health data and goals → Connect Health Connect.
3. iOS: needs an Apple Developer account and signing. "Build iOS app (check only)" proves it compiles.
4. Check your watch first: Settings → Health Connect → App permissions / Data and access. If the watch app is not listed
   as writing steps or heart rate, its data will not reach FIT4LIFE.
