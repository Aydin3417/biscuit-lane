# App Store screenshots

Seven slides, in English and Turkish, at the one size the App Store asks an iPhone app for: **1320 × 2868** (iPhone 6.9"). Upload `screenshots/en/phone/01.png … 07.png` to English (U.S.) and `screenshots/tr/phone/…` to Turkish, in that order.

| File | What it is |
|---|---|
| `capture.js` | Photographs the real game at an iPhone's point size (393 × 798, 3x) in the seven states the slides use, and draws each animal alone with the game's own `drawBody`. Writes `raw/`. |
| `slides.html` | The slides: a headline, a phone frame and a background around those photographs. Open it in a browser to see all seven; `#tr` for Turkish, `#en-3` for one slide alone. |
| `render.py` | Photographs each slide with headless Edge or Chrome, flattens to RGB, checks the exact size, and builds a contact sheet per language. Writes `screenshots/`. |

```bash
node store/slides/capture.js
python store/slides/render.py
```

`raw/` is not in the repository: `capture.js` remakes it in a minute, and `slides.html` shows nothing until it has. Run both again after any change to how the game looks; run only the second after a change to the copy.

## The slides

| # | Headline (EN) | Headline (TR) | Screen shown |
|---|---|---|---|
| 1 | Match 3 with **your own pets** | **Kendi hayvanlarınla** üçlü eşleştirme | A level in play: rockets and a bomb on the board, the goal half done, the pet half charged |
| 2 | Adopt cats and dogs, **watch them grow** | Kedi, köpek sahiplen, **büyümelerini izle** | The room: the pet, the next level, the daily walk, the season book |
| 3 | A puzzle lane that **keeps on going** | Hiç bitmeyen bir **bulmaca yolu** | The map around level 31 |
| 4 | Pick who comes **home with you** | Eve kim gelecek, **sen seç** | The breed picker from the first launch |
| 5 | Decorate a **cozy** room for them | Onlara **sıcacık** bir oda döşe | The shop's furniture shelf |
| 6 | **A gift on the step,** a walk to take | **Kapıda bir hediye,** günün yürüyüşü | The daily basket and its seven-day ladder |
| 7 | Three stars and **one happy cat** | Üç yıldız ve **mutlu bir kedi** | The win card |

The first three carry the words of the store name and subtitle (match 3, pets, adopt, cats, dogs, puzzle), because those are the three the search results show and the App Store reads the text in them.

## Every claim, against the build

Guideline 2.3 asks that screenshots show the app as it is. Each screen is a photograph of the game, so the pictures cannot drift; these are the sentences.

| Claim | True because |
|---|---|
| "The cats and dogs on the board are the ones you adopt and raise" | The board's tile faces are the player's own animals (`castOf`, 15-save.js) |
| "A happy pet brings extra moves" | `perksFor`: a fed pet adds moves at the start of a level |
| "Hundreds of levels" / "keeps on going" | Sixty hand-built levels, then a generated run that does not end |
| "Mud, crates, brambles and baskets to walk home" | Four of the seven goal kinds, all met in the first fourteen levels |
| "Three cats, three dogs … its own special move" | `BREEDS` and `ABILITIES`, six of each |
| "Rugs, armchairs, cat towers, hats and collars, all earned by playing" | All priced in coins, and coins are only earned (or converted from treats) |
| "A daily basket that grows for seven days, and a fresh level every morning" | The gift ladder and the daily walk |
| "Plays offline" | Nothing is fetched to play; videos, anonymous play data and purchase checks need a connection and the game runs without them |
| "No ad ever breaks into a level: a video only when you ask" | Rewarded video only (19-ads.js); there is no interstitial format in the build |

Nothing shown is behind a purchase.

## iPhone only, for now

The app targets iPhone alone (`TARGETED_DEVICE_FAMILY = 1`). On a wide screen the game is a 468-point frame in the middle of the display, which on a 13" iPad is under half the width, and it has never been seen on one. An iPad owner can still install it and it runs as an iPhone app. Going universal later is a setting; going back after shipping universal is not allowed, so this is the direction that can be undone. `capture.js all` and `render.py pad` still make the iPad set for the day the layout is worth showing.
