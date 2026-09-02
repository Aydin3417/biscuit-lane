# Privacy Policy — Biscuit Lane

**Last updated: 2 September 2026**

Both stores require a privacy policy at a public URL before a listing can
go live, even for an app that collects nothing. This is that document.
Host it somewhere permanent — a GitHub Pages file is enough — and put the
URL in Play Console and App Store Connect.

**It describes the app as it is built today.** If you wire up the
telemetry sink or a billing plugin, the two marked sections below stop
being true and must be rewritten before that build ships. Shipping a
policy that no longer matches the app is the single most common reason a
listing is pulled.

---

## The short version

Biscuit Lane does not collect your personal information, does not ask
you to make an account, and does not send anything about you anywhere.
The game runs entirely on your device and works with no internet
connection at all.

## What is stored, and where

Everything the game remembers is kept in your device's local browser
storage, inside the app. It never leaves the device. It is:

- Your progress: which levels you have finished and the stars and scores you got.
- Your animals: the breed, coat, eye colour and name you chose, and how they are doing.
- Your things: coins, treats, hearts, food, toys, furniture and boosters.
- Your settings: sound, music, vibration, theme, language and the colour-blind mode.
- A random number, made up the first time you open the game, used only to tell one install's own records apart from another's if you ever turn on data sharing. It is not linked to you, your device or any account.

Deleting the app removes all of it. Inside the game, **Settings → Start
over** does the same thing without uninstalling.

## What we do not collect

No name, email address or phone number. No account. No contacts, photos,
microphone or camera. No location. No advertising identifier. No device
fingerprint. There are no third-party analytics, advertising or tracking
libraries in the app — none at all.

## The internet

The game plays fully offline. It reaches the network for exactly one
thing: the two typefaces it draws its text in, which are requested from
Google Fonts the first time you open it, and which your device then
caches. Google may log that request the same way it logs any request for
a web font; see Google's privacy policy. If the request fails the game
uses a font already on your device and carries on.

Nothing else in the app makes a network request.

## Optional play data — *currently inactive*

> **Developer note — delete this quote block before publishing.** The app
> contains a switch called "Share play data", on by default, and the
> counters behind it. There is no server attached to it, so as this build
> ships **nothing is transmitted** and the events only sit on the device
> until they are overwritten. Both stores must be told "no data
> collected" for this build. The moment you attach a sink, come back and
> rewrite this section to name what you send, who receives it and how
> long they keep it, and change the store answers to match.

If a future version turns this on, it would send only counts of things
that happened in the game — a level was started, a level was lost and
how far short it was, an error occurred and on which line. It would never
include your pet's name or any text you typed; the code drops anything
that is not a number or a short fixed keyword before it is written down.
You can turn it off at any time in **Settings → Share play data**, and
off means nothing is even recorded.

## Purchases — *not available in this build*

> **Developer note — delete this quote block before publishing.** This
> build has no billing plugin, so no purchase can be made. Rewrite this
> section, and the store answers, when one is added.

If purchases are added, they are handled entirely by Apple or Google.
The game never sees, receives or stores your card details, billing
address or any other payment information.

## Children

The game is suitable for all ages. Because it collects nothing and shows
no advertising, it does not knowingly collect personal information from
anyone, of any age. There is nothing in it that could identify a child.

## Your rights

Since none of your information is held by us, there is nothing for us to
show you, correct, export or delete. Everything is on your device and
under your control: uninstalling the app, or using **Start over**,
removes all of it permanently.

## Changes

If this policy changes, the date at the top changes with it, and a
version of the app that behaves differently will not be published before
the policy describing it is.

## Contact

Questions about this policy: **[YOUR CONTACT EMAIL]**

*Replace the line above with a real address before publishing — both
stores check that it exists and reject placeholders.*
