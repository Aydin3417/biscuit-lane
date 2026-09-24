# Prompts for the pictures still to make

Paste each into the Gemini chat that holds the style references
(`English Country Lane Game Background`), one at a time. Save the result
under the file name given, in `art/src/`, then run:

```
node tools/art-cut.js art/src/props-1.png prop-tree prop-tree2 prop-bush
node tools/art-cut.js art/src/props-2.png prop-cottage prop-gate prop-gate-open
node tools/art-cut.js art/src/props-3.png prop-lamp
node tools/art-cut.js art/src/icons.png icon-heart icon-coin icon-treat
node tools/art-embed.js && npm run build && node tools/store.js
```

The cut files land in `art/` and the game picks them up by name; until a
file exists the game keeps drawing that thing itself.

---

**props-1.png** — trees and a bush

> Generate an image. Keep exactly the style, palette and outline weight of the furniture sprite sheets you made earlier in this chat: flat cartoon sticker illustration, flat fills with a single soft shadow tone, a thick warm dark-brown outline of even weight around every shape (never black), rounded chunky friendly shapes. Subject: a sprite sheet of three separate props for a game map of an English country lane, in one row with lots of empty space between them, same slight three-quarter view, same scale: 1) a round leafy tree with a short brown trunk, 2) a taller tree with a tiered narrower crown, 3) a small rounded hedge bush with a few tiny white flowers. Background: plain flat pure white #FFFFFF everywhere, no ground, no shadow, no text, no border. Aspect ratio 16:9.

**props-2.png** — cottage and gate

> Generate an image. Same style as before. Subject: a sprite sheet of three separate props for the same map, one row, lots of space between them, same scale: 1) a small cosy cream cottage with a red tiled roof, a chimney, two warmly lit windows and a little door, 2) a wooden five-bar farm gate between two posts, CLOSED, 3) the SAME gate standing OPEN, swung back. Background: plain flat pure white #FFFFFF everywhere, no ground, no shadow, no text, no border. Aspect ratio 16:9.

**props-3.png** — lamp

> Generate an image. Same style as before. Subject: one old-fashioned country lamp post, a dark green iron post with a small lantern on top, centred, standing upright, the lantern unlit. Background: plain flat pure white #FFFFFF, no ground, no shadow, no text, no border. Aspect ratio 16:9.

**icons.png** — the purse

> Generate an image. Same style as before, but as three small game currency icons that must read clearly at 24 pixels: bold simple shapes, very thick outline, bright saturated colour, one highlight. In one row with lots of space between them, same size: 1) a plump glossy red heart, 2) a shiny gold coin with a small paw print stamped in the middle, 3) a bone-shaped dog biscuit in warm cookie brown. Background: plain flat pure white #FFFFFF, no shadow, no text, no border. Aspect ratio 16:9.

**banner.png** — the store's feature graphic scene

> Generate an image. Keep exactly the style of the first country lane picture in this chat. Subject: a wide cosy scene, aspect ratio 2:1, of a sunny country lane winding from the lower right towards a cream cottage with a red roof on the right, soft meadow and hedges, warm late-afternoon light. The LEFT 45% of the picture must be calm and simple — soft sky and plain meadow only — because a title will be placed there. The lane in the lower right must be empty because an animal will be placed there. No animals, no people, no text, no border.
