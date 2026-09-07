/* Runs the Android project's Gradle wrapper from an npm script.

   `gradlew` works from cmd.exe and `./gradlew` works from a shell, and
   npm picks the interpreter by platform — so a single hardcoded script
   line runs on whichever machine wrote it and fails on the other. iOS
   needs a Mac, so this project will be built from both.

     node tools/gradle.js assembleDebug
     node tools/gradle.js bundleRelease

   Before any of that it says what is missing, because Gradle will not.
*/
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');

/* Say what is missing before spending two and a half minutes finding out.

   Gradle's own answer to an old JVM is "Could not resolve
   com.android.tools.build:gradle:8.13.0 — dependency requires at least
   JVM runtime version 11", printed after a full configuration phase and
   buried under a deprecation notice about Gradle 9. Every word of that
   is true and none of it says "install a newer JDK", which is the whole
   of the fix.

   Each check below is one somebody would otherwise make by hand, after
   the build failed, having read the wrong error. */
function preflight() {
  const out = [];

  const jv = spawnSync('java', ['-version'], { encoding: 'utf8' });
  const first = ((jv.stderr || '') + (jv.stdout || '')).split(/\r?\n/)[0] || '';
  const m = first.match(/version "(\d+)(?:\.(\d+))?/);
  /* 1.8.0_291 is Java 8; 17.0.9 is Java 17 */
  const major = m ? (m[1] === '1' ? +m[2] : +m[1]) : 0;

  if (!m) {
    out.push([
      'no java on PATH',
      'Android Gradle needs JDK 17. Install Temurin 17, or use the one',
      'Android Studio ships:  set JAVA_HOME=<studio>\\jbr'
    ]);
  } else if (major < 17) {
    out.push([
      'java is ' + first.trim(),
      'Android Gradle needs 17 or newer. Install a JDK 17 and point',
      'JAVA_HOME at it; Android Studio ships one at  <studio>\\jbr'
    ]);
  }

  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');
  if (!fs.existsSync(sdk)) {
    out.push([
      'no Android SDK at ' + sdk,
      'Install Android Studio, or the command-line tools alone, and set',
      'ANDROID_HOME to wherever the SDK landed.'
    ]);
  }

  if (!fs.existsSync(path.join(ROOT, 'node_modules', '@capacitor'))) {
    out.push(['capacitor is not installed', 'npm install']);
  }
  if (!fs.existsSync(path.join(ROOT, 'www', 'index.html'))) {
    out.push(['www/ is empty', 'npm run pack']);
  }
  if (!fs.existsSync(path.join(ROOT, 'android', 'gradlew')) &&
      !fs.existsSync(path.join(ROOT, 'android', 'gradlew.bat'))) {
    out.push(['no gradle wrapper in android/', 'npx cap add android']);
  }
  return out;
}

const gaps = preflight();
if (gaps.length) {
  console.error('cannot build the android app on this machine yet:');
  console.error('');
  gaps.forEach(g => {
    console.error('  - ' + g[0]);
    g.slice(1).forEach(l => console.error('    ' + l));
    console.error('');
  });
  console.error('  Nothing else is waiting on it. The web build, the store listing');
  console.error('  and the store graphics are done: see store/ and privacy.html.');
  process.exit(1);
}

const dir = path.join(ROOT, 'android');
/* an absolute path, because with a shell the command name resolves
   against PATH rather than against cwd */
const wrapper = path.join(dir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const args = process.argv.slice(2);
if (!args.length) args.push('assembleDebug');

/* ---------- said before the build, not after it ----------

   A release build without a key produces `app-release-unsigned.apk`,
   successfully, in a minute and a half, and says nothing about it. The
   Play Console then refuses the upload, which is the first anybody hears
   — and by then the useful sentence ("you have not made an upload key
   yet") has to be reconstructed from a console error about signature
   schemes.

   Not an error here. Building a release to check that it compiles is a
   perfectly ordinary thing to do without a key, and android/app/build.
   gradle falls back to unsigned deliberately. This is only the warning
   that comes with it. */
if (args.some(a => /[Rr]elease/.test(a))) {
  const props = [path.join(ROOT, 'android', 'keystore.properties'),
                 path.join(os.homedir(), '.gradle', 'gradle.properties')];
  const has = props.some(f => {
    try { return /BL_STORE_FILE\s*=/.test(fs.readFileSync(f, 'utf8')); } catch (e) { return false; }
  });
  if (!has) {
    console.error('');
    console.error('  note: no upload key configured, so this release build will be UNSIGNED');
    console.error('  and the Play Console will refuse it. To make one, once, ever:');
    console.error('');
    console.error('    keytool -genkey -v -keystore pawtika-upload.jks' +
      ' -keyalg RSA -keysize 2048 -validity 10000 -alias upload');
    console.error('');
    console.error('  then put four lines in ~/.gradle/gradle.properties:');
    console.error('    BL_STORE_FILE=<absolute path to the .jks>');
    console.error('    BL_STORE_PASSWORD=...   BL_KEY_ALIAS=upload   BL_KEY_PASSWORD=...');
    console.error('');
    console.error('  Keep the .jks and its passwords in a password manager. Losing them');
    console.error('  means never being able to update this listing again.');
    console.error('');
  }
}

const r = spawnSync(wrapper, args, { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.error) {
  console.error('could not run the gradle wrapper in android/.');
  console.error('  npx cap add android   (if the project is not there yet)');
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
