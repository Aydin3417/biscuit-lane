/* Runs the Android project's Gradle wrapper from an npm script.

   `gradlew` works from cmd.exe and `./gradlew` works from a shell, and
   npm picks the interpreter by platform — so a single hardcoded script
   line runs on whichever machine wrote it and fails on the other. iOS
   needs a Mac, so this project will be built from both.

     node tools/gradle.js assembleDebug          */
const { spawnSync } = require('child_process');
const path = require('path');

const dir = path.join(__dirname, '..', 'android');
/* an absolute path, because with a shell the command name resolves
   against PATH rather than against cwd */
const wrapper = path.join(dir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const args = process.argv.slice(2);
if (!args.length) args.push('assembleDebug');

const r = spawnSync(wrapper, args, { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.error) {
  console.error('could not run the gradle wrapper in android/.\n' +
    '  npx cap add android   (if the project is not there yet)');
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
