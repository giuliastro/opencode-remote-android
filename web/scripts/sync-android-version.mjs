import { readFileSync, writeFileSync } from "node:fs"

const [, , versionName, rawVersionCode] = process.argv

if (!versionName || !rawVersionCode) {
  throw new Error("Usage: node sync-android-version.mjs <versionName> <versionCode>")
}

const versionCode = Number(rawVersionCode)
if (!Number.isInteger(versionCode) || versionCode <= 0) {
  throw new Error(`Invalid versionCode: ${rawVersionCode}`)
}

const gradleFiles = [
  "web/android/app/build.gradle",
  "web/android/app/build.gradle.kts"
]

let targetPath = ""
let source = ""

for (const filePath of gradleFiles) {
  try {
    source = readFileSync(filePath, "utf8")
    targetPath = filePath
    break
  } catch {
    // Ignore missing file and try next candidate.
  }
}

if (!targetPath) {
  throw new Error("Android app Gradle file not found")
}

const versionCodePattern = /(versionCode\s*=?\s*)\d+/
const versionNamePattern = /(versionName\s*=?\s*)(["']).*?\2/

if (!versionCodePattern.test(source) || !versionNamePattern.test(source)) {
  throw new Error(`Could not locate version fields in ${targetPath}`)
}

const withVersionCode = source.replace(versionCodePattern, `$1${versionCode}`)
const withVersionName = withVersionCode.replace(versionNamePattern, `$1"${versionName}"`)

writeFileSync(targetPath, withVersionName)
console.log(`Updated ${targetPath} to versionName=${versionName}, versionCode=${versionCode}`)
