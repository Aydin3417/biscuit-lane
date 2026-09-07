package com.pawtika.game;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/* The strip above the game.

   Capacitor's generated activity leaves the system bars opaque and grey,
   so a cream game sat under a grey shelf and a dusk game under a bright
   one. On a first launch that reads as a bug rather than as a choice,
   and it is the first thing anybody sees.

   The web layer already expects to own that space — the top bar pads
   itself by env(safe-area-inset-top), which only means anything when the
   app draws behind the status bar. So the fix is to let it, rather than
   to keep repainting a bar the game cannot see. */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(0x00000000);
        getWindow().setNavigationBarColor(0x00000000);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            /* Android 10 and up paints its own scrim behind a transparent
               bar unless told not to, which puts the grey band back. */
            getWindow().setNavigationBarContrastEnforced(false);
            getWindow().setStatusBarContrastEnforced(false);
        }

        /* The icons inside the bars are drawn by Android, which cannot
           read a canvas and has to be told which way round the game is.
           Seeded from the system's night mode so the very first frame is
           right before any script has run, then kept in step by
           applyTheme() through the interface below. */
        applyBars((getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) != Configuration.UI_MODE_NIGHT_YES);
        getBridge().getWebView().addJavascriptInterface(new Bars(), "BLBars");
    }

    void applyBars(final boolean lightBackground) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                View v = getWindow().getDecorView();
                WindowInsetsControllerCompat c =
                        new WindowInsetsControllerCompat(getWindow(), v);
                c.setAppearanceLightStatusBars(lightBackground);
                c.setAppearanceLightNavigationBars(lightBackground);
            }
        });
    }

    /* Dark glyphs on a light game, light glyphs on a dark one. */
    public class Bars {
        @JavascriptInterface
        public void light(boolean lightBackground) {
            applyBars(lightBackground);
        }
    }
}
