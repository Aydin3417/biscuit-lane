/* ============================================================
   75 — the native shell, when there is one
   ============================================================

   The game is a web page first and stays one. Everything here is
   guarded on the Capacitor bridge being present, so in a browser this
   file registers nothing and costs nothing.

   The plugins are reached through window.Capacitor.Plugins rather than
   imported. That is not a shortcut around a bundler — it is how the
   bridge exposes them, and it means the shipped HTML still has no
   import statement and no dependency in it. The npm package exists for
   the native half, which registers the Java side at build time. */

const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform &&
                  window.Capacitor.isNativePlatform());

/* ---------------- the hardware back button ----------------

   Android sends back to the activity, and an activity that does nothing
   with it finishes — so without this the button closes the whole game
   from anywhere, mid-level, with no warning. That is not a small
   omission; it is the single most-pressed control on the device doing
   the most destructive thing in the app.

   What it should do is what the on-screen back does, which the game
   already knows how to decide:

     a sheet is open        close the top one
     a level is being played  ask, the same as the quit button
     anywhere but home      go home
     home                   leave, but say so first

   The last one is a double press. Exiting a game because a thumb
   brushed the bar is worse than one extra tap, and the toast is already
   in the game. */
let leaveArmed = 0;
/* Shorter than the toast, deliberately. A toast lives 1.9s and takes
   .32s to fade, so a 2.5s window outlives the only thing telling the
   player it is open — and a second press into that gap closes the game
   with nothing on screen having asked for it. The offer should never
   outlast the sentence that made it. */
const LEAVE_WINDOW = 2000;

function nativeBack() {
  /* a sheet first, whatever else is true: it is the thing in front */
  if (sheetIsOpen()) {
    const top = modalStack[modalStack.length - 1];
    if (top) { SFX.tap(); top.close(); return; }
  }
  if (SCREEN === 'game') { SFX.tap(); confirmQuit(); return; }
  if (SCREEN !== 'home') { SFX.tap(); setScreen('home'); return; }

  if (now() - leaveArmed < LEAVE_WINDOW) {
    const App = window.Capacitor.Plugins.App;
    if (App && App.exitApp) App.exitApp();
    return;
  }
  leaveArmed = now();
  toast(T('leave_again'), 'back');
}

if (NATIVE) {
  const P = window.Capacitor.Plugins || {};
  if (P.App && P.App.addListener) {
    P.App.addListener('backButton', nativeBack);
  }
  /* The web build keeps its service worker — it is what makes the game
     work on the underground. A native shell has no use for one: the
     files never travel, and a cache-first rule would pin an old build
     across an app update. tools/pack.js leaves it out of the payload,
     and this clears any that a player's WebView picked up from visiting
     the web version on the same device. */
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations()
      .then(rs => rs.forEach(r => r.unregister()))
      .catch(() => { });
  }
}
