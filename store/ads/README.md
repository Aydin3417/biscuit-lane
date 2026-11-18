# Advertisements

Vertical films of the game, 1080 × 1920 at 30 frames a second, in Turkish and English, for the placements that take one: TikTok, Reels, Shorts, Meta and Google app campaigns. Every screen in them is the game running; nothing is drawn for the film.

```bash
node store/ads/record.js basket tr     # one film, about three minutes
sh store/ads/all.sh                    # all six, about twenty
```

Needs `ffmpeg` on the path and Playwright (`npm install`). Films land in `out/`, which is not in the repository: seven megabytes each, remade from the build whenever the game changes how it looks.

| File | What it is |
|---|---|
| `stage.html` | The page a film is shot on: a background, a headline, and a phone whose screen is `pawtika.html` in an iframe. 540 × 960, photographed at 2x. Opened in a browser it plays in real time, silently, which is enough to read a film while writing it. |
| `films.js` | The films. Each is an async function that presses the game's own buttons, calls its own `tryMove`, moves the camera and changes the headline. All the copy is here, both languages. |
| `clock.js` | Takes the page's clock away from the machine (below). |
| `bed.js` | The music, synthesised. |
| `record.js` | Steps the page a sixtieth of a second at a time, photographs it, collects the sound and hands both to ffmpeg. `--look` keeps a small photograph every quarter second and makes no film. |

## The films

| Film | Opens on | Length | For |
|---|---|---|---|
| `basket` | The first launch: a basket on the step, who is in it, a name. Then the board, the room, the name of the game. | 25 s | The story hook. Cold audiences who have not asked for a match-3. |
| `board` | The board, mid-level, with the cat's move ready. Then the room and the name. | 17 s | The play hook. Audiences already playing match-3 games. |
| `basket --cta=soon` | The same, ending on "Coming soon". | 25 s | Before the store page is live. |

The two hooks are the test. Same scenes, same words, same game, different first three seconds: whichever holds people past second three on a small budget is the one to spend on.

Each film is written out twice from one set of frames: `basket-tr.mp4` with the bed under the game's sounds, and `basket-tr-sfx.mp4` with the game's sounds alone, for laying a platform's own licensed track over. `-cover.jpg` is the still a feed shows before the film plays.

## Why the page does not run in real time

Headless Chromium rasterises on the CPU on this machine, so a recording of the game playing live is a recording of dropped frames (the same reason the emulator's frame times mean nothing). `clock.js` runs before anything else in both the stage and the game and replaces what keeps time:

- `performance.now`, `Date.now`, `requestAnimationFrame` and the timers advance only when `record.js` says so, by exactly 1/60 s;
- CSS animations and transitions are paused and stepped through the Web Animations API, because they follow the compositor's clock, not the page's;
- `AudioContext` is an `OfflineAudioContext` that is suspended at every frame boundary and resumed for the next, so the game's own synthesiser renders the sound in step with the picture: a pop is on the frame that drew it;
- `Math.random` is seeded, and a scene reseeds before it deals a board.

A 25-second film is 1,534 steps and 767 photographs and takes about three minutes to shoot. It is not bit-for-bit repeatable: fonts and pictures still decode in real time, and a sprite that is ready one step sooner moves the dice. So the moves are found, not written down (the first legal match of the cat's own face; the rocket and the bomb wherever the first match left them), a film that does not end its level on three stars stops with an error instead of being written, and every finished film is looked at before it is used.

## What a film arranges, and what it does not

Nothing is faked on screen, but a film does not wait thirty moves for a good moment either. Each scene opens on a save a player could have, set up off camera:

| Scene | Arranged | Left to the game |
|---|---|---|
| Basket | Nothing. A fresh save. The coat screen is stepped through without being shown. | Every card, the meow, the welcome. |
| Board | Level 1, a rocket and a bomb lying side by side, the cat's move charged, two moves left, the goal five short, score at 86 % of three stars. | The deal, the match, where the cat lands and what she leaves, the blast, the cascade, the stars it earns, the win card. |
| Room | The cat two bond points short of growing up; a game of wool is worth two. | The game, the mood line, growing up, the stronger move. |

## Every claim, against the build

| Headline | True because |
|---|---|
| "A basket on your step. Would you open it?" | The first screen of a fresh install (`runOnboarding`, step 0). |
| "A cat or a dog? You choose" | `BREEDS`: three cats, three dogs. |
| "Then give them a name" | Step 3 of the same. |
| "Now the face you match is your own cat" | The animal you walk with stands in board slot 0 (`castRebuild`, 15-save.js), and level 1 asks for thirty-four of slot 0: the first goal of the game is the player's own cat. |
| "Stuck? Olive jumps in" | `firePetAbility`: the Sable's move leaves rockets on the board, and costs no move. |
| "Three stars, one happy cat" | The win card as the game drew it; the stars are the ones that score earned. |
| "Play with them, watch them grow" | `carePlay` adds bond, bond moves a kitten to a young cat (`STAGES`), and `stageUpModal` says so. |
| "Plays offline" | Nothing is fetched to play. |
| "No ad breaks into a level" | Rewarded video only (19-ads.js); the build has no interstitial format. |
| "Download free" | Free in every territory; nothing shown is behind a purchase. |

The last card says iPhone because that is the only store the game is in. It carries no store badge: Apple's and Google's are their artwork with their own rules, and are added from their marketing kits when a placement wants one.

## Where things sit, and why

The feeds draw their own interface over a vertical film: roughly the top 13 % and the bottom 20 % on Reels, a little less on TikTok, and a column of buttons down the right of the lower half. So the headline starts at 240 px of 1920 and the board ends at about 1580; what bleeds off the bottom is the phone's own chin. The phone fades out under the headline rather than being made small enough to clear it: at this framing the board is 730 px wide, against about 450 if the whole phone had to fit under the words.

The words are the game's own type (Grandstander) and the backgrounds are the store slides', one per scene, so a film and the store page it leads to look like the same thing.

## The sound

The game has no music, and a film of taps and pops is mostly silence: on the first cut, sound was present for under a third of 26 seconds. `bed.js` writes a bed of mallets, a soft bass and a shaker in C, which is the key every effect in the game is already in (`PENT`, 20-audio.js), so it cannot clash with a pop or a win wherever they fall. Its tempo is whichever one near 104 puts a bar line on the last card. It is oscillators, like everything else here: nothing to license.

Levels as measured on `basket-tr`: effects −23 LUFS on their own, bed −25, mixed and brought to −16 with a true peak under −1.5. Nobody has listened to it on this machine, which has no ears; listen before spending money on it, and use the `-sfx` cut with a platform track if the bed is not to taste.

## The words that go under a film

A caption is read after the film has already been stopped on, so it says the one thing the film cannot: that it is free, and where. Copy from here.

**Türkçe**

```
Kapına bir sepet bırakılmış. İçinden kim çıkacak, sen seç; sonra tahtada onun yüzünü eşleştir. Pawtika, iPhone'da ücretsiz.
```

```
Tahtadaki kedi senin kedin. Eşleştir, oyna, büyümesini izle. İnternetsiz oynanır.
```

```
#pawtika #kedioyunu #köpekoyunu #eşleştirmeoyunu #bulmacaoyunu #internetsizoyunlar #sevimlioyunlar #mobiloyun
```

**English**

```
Someone left a basket on your step. Pick who comes home, then match their face on every board. Pawtika, free on iPhone.
```

```
The cat on the board is your cat. Match, play, watch them grow. Plays offline.
```

```
#pawtika #match3 #catgame #doggame #petgame #cozygames #offlinegames #indiegame
```

Before the store page is live, the same captions end "Çok yakında App Store'da" and "Coming soon to the App Store", under the `-soon` films.
