// Adds the Health Connect (Android) and HealthKit (iOS) settings to the generated native projects.
// Run automatically by `npm run add:android` / `npm run add:ios`. Safe to run twice.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const platform = process.argv[2]
const root = process.cwd()

const READ_PERMS = ['STEPS', 'HEART_RATE', 'RESTING_HEART_RATE', 'ACTIVE_CALORIES_BURNED', 'TOTAL_CALORIES_BURNED', 'SLEEP',
  'OXYGEN_SATURATION', 'RESPIRATORY_RATE', 'HEART_RATE_VARIABILITY', 'WEIGHT']

function android() {
  const file = join(root, 'android/app/src/main/AndroidManifest.xml')
  if (!existsSync(file)) throw new Error('AndroidManifest.xml not found. Run "cap add android" first.')
  let x = readFileSync(file, 'utf8')
  if (x.includes('health.READ_STEPS')) { console.log('Android manifest already patched.'); return }

  const perms = READ_PERMS.map((p) => `    <uses-permission android:name="android.permission.health.READ_${p}" />`).join('\n')
  const queries = `    <queries>\n        <package android:name="com.google.android.apps.healthdata" />\n    </queries>\n`
  x = x.replace(/<application/, `${queries}${perms}\n\n    <application`)

  // Health Connect requires the app to show a privacy rationale screen.
  const main = /android:name="([^"]*MainActivity)"/.exec(x)?.[1] ?? '.MainActivity'
  x = x.replace(/(<activity[^>]*android:name="[^"]*MainActivity"[^>]*>)/, `$1
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>`)
  const alias = `
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE"
            android:targetActivity="${main}">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>
`
  x = x.replace(/<\/application>/, `${alias}    </application>`)
  writeFileSync(file, x)

  // The Health Connect plugin needs Android 8 (API 26) or newer; Capacitor's default is lower.
  const vars = join(root, 'android/variables.gradle')
  if (existsSync(vars)) {
    const v = readFileSync(vars, 'utf8')
    writeFileSync(vars, v.replace(/minSdkVersion\s*=\s*(\d+)/, (m, n) => (Number(n) < 26 ? 'minSdkVersion = 26' : m)))
  }

  // Privacy policy page shown from Health Connect (also served from the bundled web assets).
  const src = join(root, '../public/privacypolicy.html')
  const dir = join(root, 'android/app/src/main/assets/public')
  if (existsSync(src)) { mkdirSync(dir, { recursive: true }); copyFileSync(src, join(dir, 'privacypolicy.html')) }
  console.log('Android manifest patched.')
}

function ios() {
  const file = join(root, 'ios/App/App/Info.plist')
  if (!existsSync(file)) throw new Error('Info.plist not found. Run "cap add ios" first.')
  let x = readFileSync(file, 'utf8')
  if (!x.includes('NSHealthShareUsageDescription')) {
    x = x.replace(/<\/dict>\s*<\/plist>/, `\t<key>NSHealthShareUsageDescription</key>
\t<string>FIT4LIFE reads your steps, heart rate, sleep and workouts to show your progress and let your coach help you.</string>
\t<key>NSHealthUpdateUsageDescription</key>
\t<string>FIT4LIFE does not write to Apple Health.</string>
</dict>
</plist>`)
    writeFileSync(file, x)
  }
  const ent = join(root, 'ios/App/App/App.entitlements')
  if (!existsSync(ent)) {
    writeFileSync(ent, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>com.apple.developer.healthkit</key>
\t<true/>
\t<key>com.apple.developer.healthkit.access</key>
\t<array/>
</dict>
</plist>
`)
  }
  console.log('iOS Info.plist patched. In Xcode, add the HealthKit capability and point CODE_SIGN_ENTITLEMENTS at App/App.entitlements.')
}

if (platform === 'android') android()
else if (platform === 'ios') ios()
else { console.error('Usage: node scripts/patch-native.mjs android|ios'); process.exit(1) }
