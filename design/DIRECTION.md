# Biscuit Lane — visual direction

This file is the contract between the art direction and the build. It is
sent to Gemini with every critique, and Gemini's job is to hold the game
to it and to argue with it where it is wrong. It is not a description of
what exists; it is what the game is trying to be, and the screenshots
are evidence about whether it got there.

Anything agreed here that the build does not do is a bug in the build.
Anything the build does that is not here and is worth keeping should be
written down here.

---

## What this game is

A match-3 where the cats and dogs on the board are the pets you adopt,
feed and raise in the room upstairs. Warm, hand-made, quiet. A cottage
lane in the late afternoon, not a candy factory.

The tone to hold: **somebody made this**, rather than **this was
generated**. The failure mode to avoid is the look of a screen that was
laid out rather than composed — evenly spaced cards of equal weight,
default radii, one accent colour applied everywhere at the same strength.

---

## The hard constraints

These are not preferences. A direction that breaks one of them cannot be
built, and proposing it wastes a round trip.

**1. There are no image files. There never will be.**
Every cat, dog, tile, room, prop and icon is drawn at runtime with
Canvas 2D paths, and every sound is synthesised with Web Audio. The
whole game is one HTML file that installs as a PWA and runs offline.

This is not a stylistic boast. It is load-bearing:

- The player picks a breed, a coat and an eye colour, and *their* pet's
  colours appear on the board tiles. Six breeds × coats × eye colours ×
  four growth stages × six tile silhouettes × special states × two
  themes is thousands of sprites. As drawings it is a few hundred lines.
- Day and Dusk recolour everything at runtime from CSS custom
  properties. A raster sprite cannot follow a theme.

So art direction arrives as **direction**, not as assets: palette,
proportion, shape language, lighting, texture rules, spacing. Reference
images are welcome and useful. They are references.

**2. Colour is gameplay.**
The six tile colours are how a player tells one tile from another. Any
palette change is measured by `test/palette.js` before it lands —
including under three kinds of colour blindness — and a change that
brings two tiles closer together is a difficulty change that no
difficulty test in this project can see.

**3. Everything is drawn every frame, on a phone.**
The board renders at 60fps with particles. `tools/frame.js` measures it.
A texture that costs a gradient per tile per frame is a design that
cannot ship. Prefer things that can be cached into a sprite or painted
once per layout.

**4. Both themes, always.**
Day and Dusk. A colour that only works on cream is half a decision.

**5. Text has to be readable.**
Contrast ratios are checked. A tone that fails them is not available,
however good it looks.

---

## Where it stands now

**Palette.** Cream ground (`#F6EADA`), warm browns for ink, one amber
accent (`#D98A18`) with a darker `#7E4C0A` for accent text, and four
supporting hues used sparingly: rose, sage, plum, sky.

**Tiles.** Six colours, each with its own silhouette — round, square,
hex, shield, gem, clover — so colour is never the only channel. An
optional symbol layer sits on top, off by default.

**Type.** Grandstander for display, Karla for body, six sizes and no
more. Headings are heavy and round; body is quiet.

**Shape.** One radius scale. Cards are soft; the board tray is a wooden
object with visible corners; the animals are built from ellipses and
have weight.

**Light.** The lane runs from a hedge at the horizon down to the tray at
your hands. The room upstairs has a window whose light follows the time
of day. Dusk is a real evening, not an inverted day.

**Motion.** Springs, not linear tweens. A matched tile swells before it
goes. Nothing bounces for decoration.

---

## Standing questions for the art direction

Things the build knows are unresolved. A critique that answers one of
these is worth more than one that restates what is already good.

1. **Deuteranopia — now with numbers, and a rendered candidate.**

   Beagle blue and Sable purple measure 6.6 dE apart for a deuteranope,
   which is to say indistinguishable by colour. Silhouettes carry it.

   `tools/palette-search.js` searched for six colours that survive all
   three kinds of colour blindness. What it found:

   - The problem is not hue. Protanopia and deuteranopia collapse the
     red-green axis and tritanopia collapses blue-yellow, so **lightness
     is the only channel all three keep**. Any palette that works has its
     six colours at six clearly different lightnesses.
   - Unconstrained, the best palette scores 46 against today's 5.2 — and
     it is a test card. Marmalade goes blood red, Beagle goes navy,
     Siamese goes neon. A pure separability optimiser spends every bit of
     the game's warmth, because separation is the only thing it scores.
   - **Holding every hue exactly where it is** and moving only lightness
     and saturation reaches **32.1**, six times today, while normal-vision
     separation actually *improves* (37.6 → 43.2). Every breed keeps its
     identity: ginger stays ginger, the beagle stays blue.

   That candidate is rendered on a real board in `shots/palette/`. Looked
   at rather than measured, it is better and not yet right: the deeper
   purple and the stronger rose are improvements, but Retriever and
   Siamese go pale and lose the jewel quality the others keep — light and
   low-chroma reads as faded, which no distance metric objects to.

   **The question for you:** is a lightness-spread palette the right
   answer for this game, and if so, how do Retriever and Siamese get
   their weight back while keeping the spread? Or is the honest answer
   that the six hues should stay exactly as they are and the symbol layer
   should be on by default, paying for accessibility with a little visual
   noise instead of with the palette?
2. **The map.** Three hundred levels of the same five props. Chapter
   gates were added; is that enough structure, or does the lane need to
   change as it goes?
3. **The board's surround.** A third of the play screen is the lane
   scenery. The paw prints now track goal progress. Is the balance
   right, or is the board still too small a part of its own screen?
4. **Weight.** Is the interface too even? Which single element on each
   screen should be the loudest, and is it?
