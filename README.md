# Biscuit Lane

A match-3 puzzle with a pet-raising layer. The cats and dogs on the board
are the same breeds you adopt, feed and raise in the room upstairs, and
how you look after them changes the level you are about to play.

Everything ships as **one self-contained HTML file**. No images, no audio
files, no libraries — every animal, biscuit, thorn and sound effect is
drawn or synthesised at runtime.

```bash
node build.js          # src/ -> biscuit-lane.html (and index.html)
```

## Layout

```
src/
  head.html        charset, title, Google Fonts link
  body.html        the DOM skeleton: screens, live regions, tab bar
  style.css        design tokens (Day / Dusk), every component
  js/
    00-util.js     helpers, easings, icons, modal + toast, wait()
    05-i18n.js     every string, English and Turkish, at parity
    10-data.js     breeds, abilities, traits, badges, goods, LEVELS, generator
    15-save.js     persistence, migration, pets, care, traits, badges, daily
    20-audio.js    synthesised sound: mallets, noise, a small room reverb
    25-art.js      the animals and objects, all path-drawn
    26-scene.js    the room, the lane, the board tray, time of day
    27-physics.js  particles, springs, camera trauma, floating text
    30-engine.js   the match-3 board: matching, gravity, specials
    40-game.js     the level: render loop, input, cascades, keyboard play
    50-room.js     the room screen and the lane map
    60-ui.js       screens, shop, family, every modal, onboarding
    70-boot.js     boot, ambience, resize, lifecycle, window.BL
test/              see below
tools/             one patch script per change, kept as a record
```

Each script in `tools/` was applied once, to the source as it stood that
day, and each one's docstring says what was wrong and how it was found.
They are a record, not a build step — most would fail or do damage if
run again, because the code they patch has moved on.

Modules are concatenated in filename order into a single scope, so a
top-level name declared twice is a fatal error — `test/check.js` guards
it, along with calls to functions that do not exist and references into
a data table that hold a key it does not have. That last one exists
because the daily walk went on calling `GEN.collect.goal` after `goal`
had been replaced by something else, and threw on one day in six with
nothing anywhere to say so.

## Tests

```bash
node test/run-all.js       # integrity, engine soak, all four difficulty curves
node test/check.js         # duplicate names, unresolved calls and
                           # declarations, dead table keys, parse
node test/sim.js           # 10k simulated moves + the level-design audit
node test/ai.js 1 60 12    # difficulty: a solver plays every level N times
node test/ai.js 61 140 6   # the same, over the generated run
node test/tune.js 1 60     # suggests move counts from measured play
node test/chains.js 400    # how deep cascades actually go
node test/ice.js           # the frost rule, all five claims
node test/care.js          # can a player actually hold the pet perks
node test/mobile.js        # manifest, worker, icons: is it installable
node tools/icon.js         # redraw the app icons from the game's logo
PERKS=1 node test/ai.js    # the same levels, with a cared-for pet
STARS=1 node test/ai.js    # how the three star tiers divide up
KINDS=1 node test/ai.js    # the generated run broken down by goal kind
```

The frame budget is checked twice: once on an ordinary level, and once
with every cell on the board bursting at the same time — 803 particles,
which is what the end of a whole-board combo looks like. Ordinary frames
run about 6ms and the heavy one about 11ms, against 16.7ms at 60fps.

That check earned its keep: it failed at 31ms after deep mud grew its
corner ridges, and the fix was not the ridges but what they exposed —
`paintMudOver` drew a radial gradient and a dozen paths per muddy cell
per frame, for a picture that never changes. A board holds thirty of
them. It is cached now, the way a tile is.

Open `test/integration.html` in the preview for the browser layer: it
loads the built game in an iframe and runs 39 checks, driving the real
thing through `window.BL`. They cover:

- **the save** — migration, corrupt values, unreadable files, timestamps
  from the future
- **play** — all 60 handcrafted levels and 20 generated ones, win, lose,
  boosters, the daily walk, the epoch guard between levels
- **the pet** — traits earned from care, badges that unlock and pay once,
  a perk that cannot grow without a ceiling
- **the interface** — keyboard play, a dialog that keeps the keyboard to
  itself, layout at 320 and 430px in both languages, both themes, every
  colour it writes text in, nothing on the board arriving unexplained
- **the machinery** — the frame budget, the lane's canvas memory, whether
  any frame sends a NaN to the canvas, whether tapping a button twice
  pays for it twice, and the sound

The layout check is worth a note: it used to set `SAVE.settings.lang` and
re-render, which does nothing, because `LANG` is a module variable only
the settings sheet wrote. Both of its passes were measuring English —
and Turkish is the longer language, so the one that would overflow was
the one never looked at. There is now a single `setLang`, and the check
runs at 320px as well as 430px, and looks for text cut off inside its own
box as well as boxes outside the frame.

### The level-design audit

`test/sim.js` refuses a level table that breaks any of these, each of
which was a real bug found by playing:

- a map must be rectangular and match its `w`/`h`
- a mud or crate goal cannot exceed what the map contains
- a collect goal cannot name a colour the board does not deal
- **a rescue level must never block a column** — a basket cannot fall
  through a hole or an ice lock, and levels that mixed them measured at
  0–20% clear

## Raising a pet

A pet is worth something on the board, and everything it is worth is
capped:

| | Kitten / Puppy | Young | Grown |
|---|---|---|---|
| built | 80% size, squat | 91% | full |
| extra moves | — | +1 | +2 |
| pounce | 1 tile | 2 | 3 |
| dig | 4 blockers | 7 | 10 |
| shadow | 2 rockets | 3 | 4 |
| fetch | 4 tiles | 6 | 8 |
| chorus | 1 cross | 2 | 3 |
| snuffle | 4 tiles | 6 | 8 |

The ability numbers live in `ABILITIES[kind].steps` and are read both by
the firing code and by the interface, so the two cannot drift.

**Nothing may grow without a ceiling.** The move bonus used to be
`floor(bond / 3)`, and bond has no upper limit. Measured over sixty
levels at six games each, that is not a small perk:

| move bonus | overall clear rate |
|---|---|
| +0 | 76% |
| +3 | 80% |
| +6 | 87% |
| +10 | 88% |

A well-raised pet was quietly retuning the whole game, and it kept going.
`test/integration.html` now asserts the ceiling.

## The room punished you for using it

A pet at 70 or better in a stat hands the board a real perk: food buys
two moves, joy starts the ability meter part-charged, a bath is worth
12% score, and a rested pet leaves a rocket lying on the board. So "can
a player who turns up and does the round actually hold those?" is a
difficulty question, and nothing had ever measured it.

`node test/care.js` walks a pet through real elapsed time using the
game's own `simulatePet()`, does at each visit what an attentive player
would do, and reports which perks are live when the level starts. The
first run answered the question flatly. Every play pattern collapsed to
the same fixed point within four days:

| | food | joy | clean | energy | perks |
|---|---|---|---|---|---|
| once a day | 74 | 14 | 100 | 0 | 2 of 4 |
| twice a day | 100 | 14 | 100 | 0 | 2 of 4 |

The pet was permanently starving-adjacent, miserable and unconscious, and
two of the four perks were unreachable by any behaviour at all.

Worse, the second row is the first row's punishment. **Playing twice a
day was strictly worse than once a day.** On the first visit a
twice-a-day player held three perks; by the fourth they held two and joy
had reached zero and stayed there. Three separate rules combined into a
trap:

- every care action *spent* energy — play −8, wash −4 — and nothing in
  the game restored it except sleeping;
- sleeping only happened if the player thought to toggle it, and then
  took real hours;
- and `carePlay` refused outright below 12 energy — so once energy hit
  the floor, joy could never be raised again.

Caring for the pet was what emptied it, and emptying it removed the
ability to care for it. The more attentive the player, the faster they
arrived at a pet they could do nothing for.

There was a fourth rule underneath, in the decay itself. It multiplied
one flat rate across the whole elapsed gap, which meant it could not
model a state change — a pet that ran out of energy mid-absence had no
way to fall asleep and start recovering — and it charged the
hungry-pet joy penalty *retroactively*: a pet that dipped under 15 food
in the last minute of a day away was billed for the entire day.

### What it does now

`simulatePet()` steps in one-hour slices, so state can change inside an
absence and the neglect penalty is charged only for the hours the pet
was actually hungry. On top of that:

- **Animals sleep when they are tired.** Below 20 energy a pet nods off
  on its own, and while asleep it spends food and joy at roughly a third
  of the awake rate. An absence is now restorative instead of purely
  destructive.
- **A pet that has slept its fill stays curled up until somebody wakes
  it.** Without this it woke the instant it topped up and started
  spending again, so how rested you found it came down to what hour you
  happened to open the app — the one stat the player could not influence
  at all. Now leaving a pet to rest is a thing you can rely on.
- **You are what wakes it.** A rested pet gets up when the player opens
  the app, which is both how animals behave and the only way the room
  stays a room — leave it to wake itself and a once-a-day player finds a
  sleeping animal every single time, and never sees the room at all. One
  still short of rested stays down, which is worth seeing.
- **A tired pet plays anyway**, at 45% of the joy and 3 energy instead of
  8, with its own mood line. The refusal was the dead end; the reduced
  return keeps the information without it.
- Rates are retuned around a once-a-day visit. Emptying every bar in
  nineteen hours only taught players that the room could not be won.

Perks are read when a level starts, so that is where they are measured —
and the interesting number is not whether a player gets a perk but how
far into a session it lasts, because each level cleared costs the pet 5
energy:

| | perks on level 1 | rocket lasts |
|---|---|---|
| once a day | 4 of 4 | 4.0 of 6 levels |
| once a day, tapped Sleep | 4 of 4 | 4.0 of 6 levels |
| twice a day | 3–4 of 4 | 2.0 of 6 levels |

Three perks are now the dependable reward for turning up and doing the
round. The rocket is the one you spend: it is there for the first few
levels of a session and runs out, which is what makes resting worth
something. `test/care.js` fails if any of the three drops below 90% of
days, if the rocket never appears, if it never runs out, or if tapping
Sleep leaves the pet worse rested than ignoring it.

## What the room is worth

Every difficulty figure in this project was measured on a bare pet with
no perks at all, which is the floor rather than the case. `PERKS=1`
gives the solver what a cared-for pet actually brings — four extra moves
between food and stage, 12% score, one rocket — and the answer is large:

| | clear rate | three stars |
|---|---|---|
| the lane, bare pet | 69% | 39% |
| the lane, cared-for pet | 81% | 63% |
| the endless run, bare pet | 66% | 55% |
| the endless run, cared-for pet | 82% | 70% |

Twelve to sixteen points of clear rate, and that is a lower bound: the
35%-charge perk fires the breed ability, which the solver has no notion
of, so it is not modelled. The shape is the right one — the room pays
handsomely, and the game is still winnable without it — but it means the
handcrafted lane has to be tuned against the bare number while knowing
the engaged player sits near the top of the band.

## Traits

A trait is the only thing in the game you cannot buy or choose: it is
decided by how you actually looked after the animal, and it takes days to
earn. All four do something real —

| | |
|---|---|
| Greedy | +15% coins |
| Playful | the pet's move charges 25% faster |
| Tidy | worth an extra move |
| Dozy | everything decays 25% more slowly while you are away |

— and only Tidy appeared anywhere, because it was the only one that
changed a move count. The other three worked in silence, which for
something earned over a week is much the same as not existing. The perk
list carries all four now. The three that are not move bonuses are read
out, not applied: each is already applied where it belongs.

## Badges

All nineteen are reachable — every stat they read has a write site, and
the two that ask for a long cascade were measured rather than assumed.
Over nine thousand moves of random play, without specials:

| chain | how often |
|---|---|
| 5 or more | about one move in 55 |
| 6 or more | one in 148 |
| 7 or more | one in 423 |
| 8 or more | one in 1,163 |

So *Five in a row* is a first-evening badge and *Eight* is a rare one,
which is what they should be. Real play beats these numbers, because
rockets and bombs are not in them. `node test/chains.js` prints the
distribution.

That counter had been running since the game was written, feeding two
badges and a line in the settings, and the moment you beat your own
record passed in silence. It says so now — once a level, at four or
better, and only when the number really is a record.

## Teaching

The tutorials covered swapping, the pet's move, specials, brambles and
baskets — and said nothing about crates, mud or ice, which turn up on
levels 6, 4 and 38 with no explanation that clearing a tile beside a
crate is what breaks it. Working out the rules is not the puzzle.

Each obstacle is now introduced the first time it appears, in the
reference sheet's own words so the two places that explain a crate agree
and the translation already exists, and the card draws the piece it is
talking about rather than the pet. The order comes out as:

    L1 swap + your pet · L3 specials · L4 mud · L6 crates
    L7 baskets · L14 brambles · L38 ice

`test/integration.html` walks the lane, finds the first level containing
each, and fails if that level says nothing.

## The reward that was already there

`if (first && n % 5 === 0) treats += 2` — every fifth level has always
paid two treats the first time it is cleared, and nothing anywhere said
so. Treats are the scarce currency: three refill your hearts, and several
shop items cost nothing else. A reward you cannot see coming is not one
you can play towards.

An uncleared level whose number is a multiple of five now wears a small
bone on the lane, and its card says what the bone is for. Both disappear
once it has been paid.

On the same screen, the win card listed the bond a clear is worth beside
a heart — the icon the top bar uses to count your lives. A player who
has just spent a heart to play reads that as getting one back. Bond is
the pet's, so it takes the paw, and says its own name.

## The endless run

Levels past 60 are generated, which makes them most of the levels anyone
actually plays, and until they were measured they were the worst part of
the game: 52% clear against 74% for the handcrafted lane, with levels
that could not be won at all and levels that could not be three-starred
at all.

Four things were wrong, and all four were numbers written down rather
than worked out:

- **the score target had no ceiling.** `base + (n - 40) * 120` asks for
  22,600 by level 120; thirty moves are worth about 15,000. Every score
  level past roughly level 100 was unwinnable, and it got worse forever.
- **the collect pair asked for perfect play.** 46 and 42 on a six-colour
  board in thirty moves measures 25%.
- **`base` is the three-star target**, and it was set from what a score
  level makes. An obstacle level makes far less, so on most of the lane
  three stars was out of reach — a crate level averaged 5,300 against a
  target of 11,100.
- **obstacle goals asked for the whole map.** Mud is quick while there is
  mud everywhere and then very slow: the last few cells are scattered and
  cost several moves each. `mud:40` was over in six moves of twenty-nine;
  `mud:45` was not over at all. Obstacle goals are now a share of what
  that particular map holds, worked out after the map exists.

### The maps

A generated map was a coin flip per cell — fair, since the goals are
worked out from whatever it produces, and shapeless. Sixty handcrafted
levels have arrangements somebody chose, and then level 61 is static.

Mud and crate levels take one of eight arrangements now, picked by seed:
bands, columns, a diamond, a ring, four corners, a checker, a wedge, or
an organic blob. They cover between a third and a half of the board, so
the stock — and therefore the goal — stays in range, and a diamond of mud
and a checker of mud each get their own number without anything else
changing. Shaping cost about four points of clear rate — 73% to 69% —
because a shaped mass walls off more of the board than a sprinkle does.

### Frost

Ice is taught on level 38 and then never appears again: the generator has
no branch that writes one, so from level 61 one of the five obstacles
simply stops existing. A mechanic taught and then withdrawn is worse than
one never taught.

Two levels in five carry a few cells of it now, from tier two — after the
player has been shown what it is — never on a rescue level, because a
basket cannot pass frost, and never more than one to a column, so no
column is ever walled off.

### Score levels

The same view over the handcrafted lane found one more, and it was
structural rather than numeric. On a level whose only goal is a score,
the goal and the thing stars are awarded for are the same quantity, and
the level ended the instant the goal was met — so the final score was
always the target plus whatever the last cascade happened to add, and
three stars was decided by that overshoot. Measured: 17% three-star
against 31-49% for every other kind, and a quarter of the move budget
thrown away.

A score level plays out its moves now. The chip fills the moment the
target is passed, so you can see you have won, and the moves that remain
decide two stars from three — which is what those moves were for. Every
other kind still ends when its goals are met, because there the score is
a separate axis and finishing early is the skill.

That made the old thresholds meaningless, so both were re-set from the
spread of final scores over sixteen games a level: clearing at the
thirtieth percentile, three stars at the sixtieth. The five score-only
levels now clear at 56-69% and three-star at 25-56%, in line with
everything else.

### Tuning by kind

A generated level is a seed, so there is nothing to tune one at a time,
and five games a level is pure noise. Eight hundred games grouped by what
the level *asks for* says what per-level verdicts cannot:

| kind | clear | three-star | spare budget |
|---|---|---|---|
| bramble | 52% | 74% | 40% |
| collect | 72% | 58% | 20% |
| crate | 63% | 17% | 29% |
| mud | 98% | 9% | 59% |
| rescue | 59% | 53% | 47% |
| score | 55% | 55% | 10% |

Three plain faults. **Mud was a walkover** — 98% clear with well over
half the budget unused, the goal met in eleven moves of twenty-eight —
and it could not be fixed by asking for a larger share, because clearing
every layer on the board still only filled half the budget. It needed
more mud in it and a shorter budget: deeper mud, a bigger share, 22 moves
instead of 28.

**Crate levels could not be three-starred and bramble levels nearly
always were** — 17% against 74%. Both are the fault that made three stars
unreachable across the lane in the first place: a score target set from
what some other kind of level makes.

After:

| kind | clear | three-star | spare budget |
|---|---|---|---|
| bramble | 61% | 47% | 47% |
| collect | 73% | 60% | 27% |
| crate | 58% | 42% | 38% |
| mud | 64% | 56% | 43% |
| rescue | 61% | 47% | 56% |
| score | 61% | 61% | 17% |

Clear rate now spans 58-73% where it spanned 52-98%, and three-star
42-61% where it spanned 9-74%. Every kind is a level somebody can lose
and somebody can master, which is the whole of what a difficulty curve
is for.

Rescue keeps the highest spare budget, and that is the mechanic rather
than the numbers: a basket either finds its way down or it does not, so
the wins come comfortably and the losses are outright.

`KINDS=1 node test/ai.js 61 160 8` prints the table.

### The numbers

Measured over levels 61-140:

| | before | after |
|---|---|---|
| clear rate | 52% | 67% |
| three-star rate | 33% | 44% |
| levels nobody can win | several | none, audited to level 360 |

The 67% is after shaping the maps and putting frost back, each of which
costs a few points; the retune on its own reached 73%. Both are inside
the 55-88% band and level with the handcrafted lane's 68%.

which puts the generated lane where the handcrafted one is (74% / 42%).
The generated levels and a year of daily boards are now audited by
`test/sim.js` alongside the handcrafted table.

## Tuning

Level numbers are measured, not guessed. `test/ai.js` plays each level
with a greedy one-ply solver — it tries every legal swap, resolves it on
a copy of the board and keeps the best — and reports clear rate, average
score and spare moves. A level is right when the solver needs about 72%
of the budget.

Measured yields, for reference when writing a new level:

| | per move |
|---|---|
| tiles cleared, 5 colours | ~11 |
| tiles cleared, 6 colours | ~8.7 |
| a targeted colour, 5 / 6 colours | ~1.9 / ~1.4 |
| crates broken (clustered) | ~2 |
| mud layers cleared | ~1.3 |
| baskets walked home | one per several moves |

Because the solver is stronger than a person, a 70% solver clear rate is
a genuinely challenging level, not an easy one.

The three star tiers each carry weight, which is worth checking rather
than assuming — a tier nobody lands on is not doing anything. Over 265
clears of the handcrafted lane:

| stars | share of clears |
|---|---|
| one | 33% |
| two | 39% |
| three | 28% |

`STARS=1 node test/ai.js 1 60 6` prints it. A clear always pays at least
one star even when the score falls short of the first target, which is
why the raw 9% of sub-threshold clears does not appear as a tier.

Five or six games a level is enough to watch the whole curve and not
enough to judge one level — the noise is about twenty points either way.
Fourteen games each is, and it found two slack levels in sixty:

| | before | after |
|---|---|---|
| L31, crate + mud in 28 moves | 80% clear, 39% of the budget spare | 25 moves, 75% |
| L50, mud + crate + collect in 34 | 95% clear, 32% spare | 29 moves, 75% |

L50 sits ten from the end of the lane and cleared nineteen times in
twenty with a third of its moves unused. Both goals are limited by what
their maps hold, so the move count was the lever.

## Hearts

A level costs a heart; one comes back every twelve minutes, five at most.
Two things were wrong with that, and both are the kind that make a game
feel broken rather than hard:

- **the countdown did not count.** The out-of-hearts sheet rendered
  "the next is in 11:47" once and never touched it again, so pressing
  Wait — which the sheet invites — looked like nothing happening. When
  the heart did arrive the sheet still said you had none and still
  offered to sell you three for treats.
- **a clock that moves backwards froze them.** Every timestamp is a wall
  clock reading, and wall clocks go backwards. `heartAt` in the future
  made `heartsIn` return the refill plus however far the clock jumped:
  the game said the next heart was a day away and would not give it up
  until real time caught up. A future timestamp is now repaired the way
  any other corrupt value is.

There is one second hand, started only while a heart is missing and
stopped when they are full, and `heartTick` announces an arrival from the
one place hearts go up.

A sheet also lingers for 300ms while it fades, and went on taking taps
the whole time: three taps on Play spent three hearts and started one
level, and the shop charged three times for one hat. Every button in a
sheet is now disabled the moment it starts closing, which covers Retry,
Keep going and Buy hearts too — and the ones nobody has written yet.

## The labels nobody sees

Four controls carried their `aria-label` in the markup: the settings
button, the leave-level button, the board, and the pet's ability button.
Switch to Turkish and every visible word follows — the tabs, the home
screen, the level card — while a Turkish screen-reader user was still
told "Settings", "Leave level", and a sentence of English about the
arrow keys.

They are in the string table now, and `setLang` moves them, rather than
the settings sheet doing it: that is the one place the language changes,
and a caller that forgets would leave the game half translated for the
people least able to notice. The layout check asserts it, which is how
the seam turned up in the first place.

## When the browser will not save

Every call into `localStorage` is wrapped, so a window that refuses
storage — a locked-down private mode, a browser set to block site data —
plays perfectly: it loads a fresh save, keeps a whole session in memory,
and raises nothing. Then the tab closes and the pet you named and raised
is gone, with nothing having warned you.

The game cannot fix that; it can say it, once, without making a fuss.
`canStore()` writes a probe key and reads it back, which catches both
failure modes — the browsers that throw, and the ones that accept the
write and quietly keep nothing.

## The button that did not play

The home screen's one primary button — the biggest, brightest control in
the game, labelled Play — called `setScreen('map')` and stopped there,
which is exactly what the Play tab in the tab bar already does. A player
who pressed it landed on the lane and had to find their own level.

It opens the level you are on now, by the same route "Carry on" takes at
the end of a level, and defers to the out-of-hearts sheet when there is
nothing to spend. The lane is still one tap away for anyone who wants to
look at their stars.

## Saying no

A care button used to be `disabled` whenever it could not be pressed, so
`openFeed`'s "No food in the cupboard" — a message somebody wrote — could
never appear. A player with a hungry pet and an empty cupboard tapped
Feed, nothing happened, and nothing told them the shop sells food.

The buttons still look unavailable, which is the honest signal, but they
take the tap and answer it: no food, no toys, fast asleep, too tired to
play. Feeding a sleeping pet used to wake it without a word; now it says
so instead.

## Light mode

The game is dark by default and light was a setting nobody had measured.
Against the surfaces they sit on, WCAG-style:

| | before | after |
|---|---|---|
| accent as text (coin counts, level numbers) | 2.66 | 6.91 |
| status pill text (a pet's stats, 11px) | 2.80 | 4.66 |
| text-faint (hints, captions) | 3.17 | 4.73 |
| ink on an accent button | 4.43 | 5.30 |

4.5:1 is the line for small text; the accent was below even the 3:1 for
large. Dark mode already passed, which is why none of it showed.

The accent is a fill as well as a text colour, so darkening it outright
would have changed every button and map node; there is now an
`--accent-strong` for text, which in dark mode is simply the accent. The
status colours were darkened at source, because they are used as text far
more than as fill.

Measuring the canvas the same way then turned up a worse one, in the
theme that ships by default: the number on a cleared level is white on
sage, which is 6.6:1 on light mode's deep green and **2.1:1** on dark
mode's pale mint. The lane is the screen you look at most, so that was
the most-seen bad contrast in the game. The numeral now takes whichever
ink reads better on the fill beneath it.

`test/integration.html` measures every pair, CSS and canvas.

## Colour blindness

Six tile colours do not survive a colour-blind eye. Simulated: orange and
gold land on the same yellow-green for both red- and green-blind vision,
and for blue-blind vision four of the six become the same pink. The
animals carry a lot of it — a cat is not a dog — but two cats of the same
simulated colour are a coin toss.

**Tile symbols** in the settings exists for this, and says the right
thing: *adds a shape to each tile so colour is never the only clue*. The
badge it drew was a tenth of a tile across — about nine pixels on a
narrow phone — and inked in the tile's own darker colour, the very thing
it stands in for. It is now a third larger, on a solid disc, with the ink
chosen against the disc. Nothing changes for anyone who leaves it off.

## The sound

Every effect is synthesised, and until it was measured nothing had ever
checked that any of it made a sound. The suite renders each one into an
`OfflineAudioContext` and reads the samples back, which is the only way
to see a fault in something no test can hear. It asserts that nothing is
silent, nothing clips, nothing runs past a couple of seconds, and that
the mix keeps its order — the chain reward louder than the match it
crowns, winning louder than a star.

The first run found three sounds being thrown away by their own filters:
`combo` had a bandpass at 900Hz sitting above the note it was supposed to
pass, and the two transition sweeps were narrow bands on white noise
carrying a tone's worth of gain.

| | before | after |
|---|---|---|
| combo (crowns a chain) | 0.005 | 0.061 |
| whoosh | 0.003 | 0.040 |
| swish | 0.004 | 0.033 |

For reference: a tap is 0.019, a match 0.038, a bomb 0.134, winning 0.35.

The music was measured the same way and was the loudest thing in the
game — peak 0.357 against the win fanfare's 0.35, and a higher RMS than
any effect. It also bypasses the compressor that holds the effects
together, so nothing was keeping it down. The bed now sits at peak 0.17,
RMS 0.019, from a single constant (`MUS_BED`), and the suite asserts it
stays under winning.

## A quote in a regex

The checker prints how many data tables it verified. That number went
from twelve to eleven when a `cleanName` helper was added, and noticing
it is the only reason the fault surfaced: the helper stripped its
characters with a regex whose class contained a quote, and the checker's
stripper — which removes string literals so their contents cannot be
mistaken for code — read that quote as the start of a string and lost the
rest of the file. `DECAY`, further down, quietly stopped being checked.

The rule is written with character codes now, so no quote appears in the
source at all. The lesson is the reason the count is printed rather than
just the failures: a number that moves is a question worth asking.

## Strings nobody shows

Every key in `STRINGS` is written twice, once per language, so a key
with no caller is two translations maintained for nothing — and a
reliable fossil of a rule that was removed. `home_tired` ("{name} is too
tired to play") outlived the rule that a tired pet refuses to play by
exactly one commit.

`test/check.js` now reads the two language books directly and checks two
things nothing had checked:

- **parity** — a key present in one book and missing from the other
  shows up in the interface as a blank, not as an error. Both books
  carry the same 229 keys.
- **orphans** — keys are not always literal (`moodOf()` returns a word
  that becomes `'mood_' + it`), so a prefix used in a concatenation
  vouches for every key beginning with it. Everything else needs a
  caller.

The first run found 23. Two of them turned out to be features rather
than fossils:

- `a11y_ready` — "{name} is ready. Press P." The ability meter filling
  is announced by a bark and a full bar, and the ability is the one
  thing on the board you have to choose to use. A screen reader was
  never told. Now it is.
- `map_best` — "Best {n}." There was no such thing as a best score per
  level; nothing stored one. There is now (see below).

The other 21 were dead, and their 42 definitions are gone.

While adding the check, `process.exitCode = bad` turned out to crash on
a boolean. Every failure path in `check.js` sets `bad = true`, so the
first time the suite ever found a dead table reference it would have
thrown a `ERR_INVALID_ARG_TYPE` instead of printing what was wrong. It
had simply never failed there before.

## A number worth beating

A level you have three-starred still has a score on it, and until now
the only reason to play it again was to farm coins, which is the least
interesting reason. `SAVE.scores` keeps the best score seen on each
level; the level card shows it before you start, and the win sheet
either shows what you have to beat or tells you that you just did.

This matters more since score-only levels started playing out their
moves: the moves after the goal is met now have somewhere to land.

## Eight levels off the line

Measured at twelve games each, the handcrafted lane had one wall and one
gift, and six more that were merely free:

| level | was | clear rate | now |
|---|---|---|---|
| 26 | collect 28 + rescue 2, 32 moves | 25% | collect 20, 34 moves |
| 42 | bramble 20 + collect 24, 32 moves | 100% | collect 26, 25 moves |
| 27 | crate 22, 32 moves | 100% | 26 moves |
| 11 | crate 28, 28 moves | 92% | 24 moves |
| 18 | crate 16, 32 moves | 92% | 26 moves |
| 31 | crate 10 + mud 20, 25 moves | 92% | 22 moves |
| 41 | two collects, 28 moves | 92% | 25 moves |
| 48 | bramble 16 + crate 8, 32 moves | 92% | 27 moves |

Level 26 was the interesting one: a 28-collect at six types alongside a
rescue is two full-attention goals sharing one move budget, and the
solver could not serve both. Level 12 sets a *larger* collect next to a
rescue and clears at 92% — because it runs five types, where the wanted
tile turns up nearly three times as often.

Score targets moved with the move counts, since `base` is the three-star
target and a level with six fewer moves cannot reach the same number.
Afterwards the lane's flagged-level list went from fourteen to five.

## The corners are the expensive cells

Levels 25 and 56 both measured brutal — 54% and 45% over twenty-four
games — and both turned out to be the same level, written twice. Their
mud goal was equal to every mud cell on the map, and both maps put mud
in the board's four corners.

A corner cell has two neighbours instead of four, so a match through it
has to arrive along one of two lines rather than one of six. Requiring
the last corner is not a slightly harder version of requiring the rest;
it is a different problem, and it is worth several times its share of
the move budget. The evidence is how sharply it turns:

| level 56, mud goal | clear rate | median score |
|---|---|---|
| 34 of 40 | 95% | 6867 |
| 36 | 100% | 8130 |
| 37 | 88% | 9319 |
| 38 | 88% | 11253 |
| 40 (all of it) | 45% | 14489 |

Six percent of the goal is worth forty points of clear rate. Twenty-two
handcrafted levels ask for 100% of their stock and most of them are
fine, so the rule is not "never ask for all of it" — it is that asking
for all of it *when the map reaches into the corners* is a different
level from the one the move count was written for. Both now stop a
little short: 26 of 28 and 38 of 40.

The same table shows why the score target has to move with the goal. On
an obstacle level the board ends the moment the goals are met, so a
smaller goal is not only easier, it scores less — 6867 against 14489 for
the same map. Level 56 kept its old target through one edit and briefly
had a 100% clear rate and a 0% three-star rate at the same time.

## A limiter that cost twenty decibels

A whole-board cascade can stack twenty voices at once, so the mix wanted
a ceiling. The obvious way to get one in Web Audio is a second
`DynamicsCompressor` after the glue compressor, set fast and steep.

That took `drop` from .018 to .006 and `tap` from .018 to .007 — quiet
sounds fell about twenty decibels while loud ones were untouched.
Bisecting it took three experiments, because the obvious suspects were
wrong: setting the limiter's ratio to 1:1 changed nothing, and
neutralising the pitch humanisation added at the same time changed
nothing. Taking the *node* out of the path restored every level exactly.

**Chrome's `DynamicsCompressor` is not transparent when it is not
working.** Two of them in series attenuate quiet material whatever the
ratio says. Nothing in the API suggests this and nothing but a
measurement would have found it — the sounds were still there, still
unclipped, just quietly wrong.

A limiter is a curve, so it is a `WaveShaper`: exactly linear below the
knee, so nothing quiet is touched at all, and asymptotic above it, so it
cannot overshoot however much is thrown at it. Measured after: every
sound above the audibility floor, nothing clipped, and nine tiles
popping with a combo and a bomb on top peaks at .22.

## Making it sound made rather than generated

Three things, none of them audible to any test that existed.

**Nothing repeats exactly.** Every one-shot is nudged a few cents off
centre and a few percent in level before it plays, noise bursts start at
a random offset in the buffer, and musical sounds get less of it than
noises do. Two taps of the same button used to be the same samples
twice; a run of them — which is what a board of matches is — read as a
machine gun rather than as a thing being struck repeatedly.

**There is something underneath.** Almost everything lived above 200Hz,
which is why it sounded like a phone speaker even on headphones. A
short sine an octave or two below the body, gone in a tenth of a second,
is the whole trick. Measured as the share of energy below 150Hz:

| | under 150Hz |
|---|---|
| a match | 12% |
| a swap | 18% |
| a crate breaking | 43% |
| a bomb | 62% |
| a tile landing | 76% |
| a tap on the interface | 5% |

The tap is deliberately still light. A button that thumps is a button
that is trying too hard.

**Contact comes before tone.** Buttons in expensive software click
before they ring, and the click is two milliseconds of filtered noise.
It is most of what tells you the press registered.

The room got two corrections while I was in there: eighteen milliseconds
of pre-delay, so the reverb no longer smears itself over the attack of
the sound that caused it, and a tail that loses its highs as it decays,
because a room filtered at one fixed cutoff for its whole length is the
sound of a plugin preset.

`test/integration.html` now fails if any one-shot renders identical
samples twice, or if an impact has no bottom.

## What the frame budget was actually measuring

The effects layer was failing its budget at 52ms, having passed at 6ms
earlier the same day. Two real costs came out of chasing it:

- **A tuft is four bezier curves, a fill, an ellipse and a second fill**,
  and at the end of a whole-board combo there are three hundred and
  sixty of them — every one of those paths walked again on every frame,
  for a shape that never changes. Tufts and crumbs are drawn once into a
  brush and stamped ever after, the way the sparks already were.
- **`shade()` builds a colour string**, and it was being called inside
  the emit loops: eight hundred throwaway strings in the single frame
  where the whole board goes at once, which is exactly where a garbage
  collection is least welcome. They do not vary per particle.

But the failure itself was not either of those. A 330-particle burst
spikes to 21ms on the same machine in the same second that an
803-particle burst runs at 9ms — the worst frame of twenty-four is a
measure of what else the computer was doing. The test now judges the
ninetieth percentile, which is what decides whether the animation looks
smooth, and holds the worst frame to a ceiling a real stall would break.
On an idle machine, after both fixes: **2.0ms a frame, 3.8ms median with
803 particles alive, 4.1ms at the ninetieth.**

Replacing the four state calls per particle with one `setTransform` was
tried and made it *worse* — 8.8ms to 15ms. It is in the notes because
the intuition is a common one and it is wrong here.

## Making the interface look decided

The complaint was that it looked generated, and it did. Every screen was
a column of white rounded cards with the same radius and the same
shadow, every action was a full-width gold bar, and the illustrations
were small things centred in large empty boxes. That is a layout, not a
composition. What follows is what changed, and why each one matters more
than it sounds.

**Surfaces are lit, not filled.** A card now carries a one-pixel
hairline of light along its top edge and a ghost of a gradient down its
face. It is a single `inset 0 1px 0` and it is most of the difference
between a panel and a rectangle.

**Elevation is a ladder, not one shadow.** Each step is a tight contact
shadow plus a wide soft one, because real light does both; a single
blurred drop reads as a sticker. The top bar and the tab bar cast onto
the content they sit over, so they stop being stripes and start being
surfaces.

**One radius scale.** Nothing is 16px next to 18px next to 20px for a
reason nobody could name any more.

**One primary action per screen.** The home screen had three gold
buttons in one view, which means none of them is the one. The thing the
player came to do — the next level — is the only gold on the screen; the
two errands sit side by side beneath it and wear their accent in the
icon and the border. Four full-width cards stacked in a column gave the
eye no idea which mattered.

**The head of the game screen is one panel.** Moves, goals and the score
you are working toward are one piece of information — where you are in
this level — and they were split across two surfaces with a rule between
them, so the screen read as three separate zones before the board even
started.

**Goods sit in a niche.** The shop was four identical gold slabs and
four small icons floating in white. The art is a third larger, stands in
a recess with a shadow under it, carries the count you already own as a
badge on the thing itself, and the price is an outlined pill. The goods
are what the player is choosing between, so the goods have the colour.

Two pieces of art were replaced outright: the carrot cake, which was a
beige rectangle with an orange dot above it, and the badges, where
nineteen different achievements all wore the same crown. Each badge now
has a picture for what it is and a colour for the kind of thing it is —
walking the lane, taking stars, a feat on the board, the family, looking
after them.

### Three bugs the screenshots found

Nothing here was visible from the code, and none of it was visible until
I stopped reading and started looking at rendered pixels.

**The family screen was broken.** The pet's name was truncated to
"Mar…", its breed to "Sable …", and "On the board" wrapped over three
lines. `paintArtCanvases` sized each canvas from `cv.width` — but
`fitCanvas` sets the backing store to size × device pixel ratio, so
reading it back and passing it in again squares the ratio on every
re-render: 56, 112, 224. The pet grew until it pushed its own name out
of the row, and the info column had 44 pixels left to work with. The
size asked for is remembered on the element now, and a test renders the
screen four times and fails if the canvas moves.

**A matched tile deflated instead of popping.** The death animation was
`(1 + k * .5) * (1 - k)` — a curve that never rises above 1, because the
shrink term wins from the first frame. The single most common event in
the game had no moment in it. It swells to 1.26× at 30% of the way
through now, its neighbours flinch, and the board takes a knock sized to
how much went: shake previously needed a chain of two, so a plain
three-in-a-row — the move a player makes more than any other — landed
with nothing behind it at all.

**The star track had no stars on it.** `buildStarTrack()` was called by
the four separate places that start a level, so any other route showed
an empty bar — and those marks are the only thing that says how far off
two stars you are. It is built inside `startLevel()` now, beside the
goal chips. A thing every caller must remember is a thing that breaks.

## The language switch nobody could reach

A `.sheet` is a scrolling flex column, and a flex item's default is to
shrink. The cards inside one carry their own `overflow:hidden`, so when
the sheet ran short of room the card was squeezed and quietly cut its
own contents off rather than letting the sheet scroll to them.

On the settings sheet that meant the card ended halfway through the
light control — and the row under it, **the English/Türkçe switch, could
not be reached at all.** A game written twice over, at full key parity
in both languages, with no way to change language from inside it.

Two smaller faults on the same sheet:

- `flex-wrap:wrap` had been put on every `.switchRow` so that the
  three-way light control could drop onto its own line in Turkish, where
  it is wider. The side effect was that any row with a long enough
  description pushed its own toggle down too: "Tile symbols" had its
  switch sitting underneath its own text. Only the light row wraps now;
  the others let the label shrink.
- `.btn.ghost` was fully transparent with a hairline border, which is
  legible on a card and invisible on the onboarding's cream stage.
  "Back" read as a piece of text that happened to be next to a button.

## The loudest button on the failure screen

Losing a level offered three controls, and the largest and most coloured
of them — a full-width rose bar — was **Buy 5 more moves · 2 treats**.
Carrying on and walking away are both free; the one that spent the
player's currency was the one the eye went to first.

Trying again is the primary now, going back is the secondary, and the
five moves are offered underneath in a dashed panel that reads as an
offer rather than an instruction. Nothing about the transaction changed.
Which of the three a tired player hits without reading did.

## Dead code

`test/check.js` finds calls with no declaration. The reverse — declara-
tions with no call — turned up twenty-one functions, and removing them
is not only housekeeping: `damageCell` and `damageNeighbourCrates` sat in
the engine looking exactly like the rule for breaking a crate, and were
not it. A function that looks like the rule and is not the rule is worse
than no function at all.

Removing a dead function makes whatever only it called dead too, so the
sweep runs to a fixed point: 21 functions over two rounds, 380 down to
359, and the bundle from 470KB to 459KB.

`check.js` reports the same thing now, so it cannot pile up again. It
reads the source exactly as written rather than through either stripper:
both of them mangle this file set — one swallows the markup-heavy
template literals along with real code — and a report full of functions
that are called on the next line is a report nobody reads.

## Debug handle

The built page exposes `window.BL` — save, game state, every screen
renderer, the level table, and `BL.fast = true`, which makes cascades
resolve without real timers so a whole level runs in milliseconds. The
integration suite drives the game entirely through it.

## The sixth breed

There are six breeds and a board deals five or six colours. Matching
your own pet's breed is the only thing joining the two halves of this
game — it is what charges the pet's move, and the HUD says so in as
many words: *Match {breed} to charge*. Nothing had ever checked that
the breed was on the board.

Twelve of the sixty handcrafted levels deal `types: 5`, along with
every generated level in the first two tiers and half the daily walks.
Tile types run 0-4 there, and the pug is breed 5. Onboarding offers all
six, so this is the first thing a player can get wrong, before they
have been told anything.

`node test/charge.js` walks the solver through real levels, counts what
it actually clears, and asks how often each breed's meter fills:

| | Marmalade | Beagle | Sable | Retriever | Siamese | Pug |
|---|---|---|---|---|---|---|
| types 5 (12 levels) | 3.19 | 3.17 | 3.19 | 3.17 | 3.08 | **1.06** |
| types 6 (48 levels) | 2.27 | 2.21 | 2.26 | 2.28 | 2.23 | 2.20 |

A third of the pet moves, on a third of the early lane, decided by
which animal you liked the look of. And the rate was the smaller half
of it, because `primaryGoalType()` handed the same number to the
abilities whenever a level had no collect goal:

- **Fetch** ran `tilesOfType(B, 5)` on a board with five types, got an
  empty list, and cleared nothing. A retriever waited sixteen moves,
  spent the meter, heard the sound, and watched the board not move.
- **Snuffle** painted its tiles colour 5 — a colour the board can never
  deal again, so any that did not happen to land in a line were dead
  cells for the rest of the level.
- **Pounce** and **Chorus** fell through to `pickSpots`, which topped up
  from random interior coordinates and gave up on the first one that
  came back a hole. A grown pet regularly pounced once for a card that
  said three.

There is one `favTypeFor(breed, types)` now, in the data beside the
breeds, and every reader goes through it: the charge, the two HUD
lines, the keyboard prompt, the level card, and the abilities' fallback
target. It is the breed while the breed is dealt and the tile beside it
when it is not, so no ability is ever aimed at a colour that is not in
play. The level card draws the tile it landed on, and the charge line
says *{name} is after {breed} on this board* rather than naming
somebody else's animal.

| types 5 | Marmalade | Beagle | Sable | Retriever | Siamese | Pug |
|---|---|---|---|---|---|---|
| before | 3.19 | 3.17 | 3.19 | 3.17 | 3.08 | 1.06 |
| after | 3.19 | 3.17 | 3.19 | 3.17 | 3.08 | **3.19** |

`test/charge.js` is judged inside each colour count rather than over
the run, which is the only reason it fails on the old build: forty-eight
six-colour levels sat on top of the twelve broken ones, and over the
whole lane the worst breed still measured 80% of the best.

### An ability that does nothing

Snuffle is *"sniffs out tiles and turns them into what you actually
need"*, and it used to paint n random tiles the wanted colour and hope
three of them landed in a line. Even with the colour right, on a quiet
board they did not: it was the one ability in the game that could
visibly do nothing with a full meter.

It lays a run of three first now, chosen where it costs the fewest
conversions, so the move always clears something; then it spends what
is left of its budget beside tiles of that colour, which is where the
next match is. Fetch goes through `pickSpots` for the same reason — the
number on the card is the number the ability does, or the board has run
out.

## How close you were

The out-of-moves card listed what the level had asked for. *You needed
6 mud* reads exactly the same at 34 of 40 as it does at 2 of 40, and
the difference between those two is the whole of whether the level is
worth another heart — the one moment in the game where a player is
deciding whether to come back.

It shows the count it showed all level: each unmet goal with its own
icon, its number, and a bar. When every one of them is 80% or better it
says *So close* first, because that is a different sentence from *out
of moves* and it is true often enough to be worth saying. A bramble is
judged the way `goalsMet` judges it — by what is left on the board —
or a patch that grew back after the counter filled would show a
finished bar on a level you had just lost.

## The first three levels

Every difficulty figure in this project is an average over sixty
levels, and an average has no idea where on the lane a level sits.
Measured on their own, at fourteen games each:

| level | teaches | clear rate | budget left |
|---|---|---|---|
| 1 | the swap, and your pet | 83% | 5 of 20 |
| 2 | — | 75% | 8 of 22 |
| 3 | **specials** | **50%** | 0 of 22 |

The audit's verdict on all three was `ok`, and it is right: 75-83% is
an ordinary level of this lane, and the lane clears at 68%. It is the
wrong number for level 1.

The solver is stronger than a person. A player on level 1 has never
swapped a tile, has no boosters, no perks, no stage moves and five
hearts, and has just been asked to name an animal they now care about.
A level the solver loses one time in six is a coin flip for them, and
losing costs one of the five hearts. Level 3 is worse: it is the level
that introduces specials, it uses every move it has, and it fails half
the time. The mechanic a level exists to teach should be the thing the
player leaves holding, not the thing that beat them.

An opening is not a difficulty band, it is an introduction. The curve
should start at the top and descend, and from level 4 it already does.

| | was | now |
|---|---|---|
| 1 | collect 38 in 20 | collect 34 in 22 |
| 2 | 32 + 26 in 22 | 33 + 28 in 24 |
| 3 | score 18,500 in 22 | score 14,500 in 24 |

Star targets moved with them, since `base` is the three-star target and
a smaller collect goal ends the level sooner and scores less.

| level | clear rate | three stars | budget left |
|---|---|---|---|
| 1 | 100% | 57% | 5 of 22 |
| 2 | 100% | 71% | 8 of 24 |
| 3 | 86% | 36% | 0 of 24 |

Level 3 still spends its whole budget, which is what a score level is
for. Levels 1 and 2 now read `TRIVIAL` to `test/ai.js`, and that is the
correct verdict for them — the flag has no notion of position, and a
first level a new player cannot lose is the point rather than a fault.

## Turkish that is Turkish

The two language books have been at full key parity for a long time,
which is a different thing from both of them being written properly.

`goalLine()` built a collect goal by appending the breed to the end of
the translated phrase:

```
T('goal_collect', { n }) + ' ' + breedName(...)
```

In English that gives "Collect 44 Marmalade". In Turkish it gives
**"44 tane topla Marmelat"** — English word order wearing Turkish words.
The breed belongs inside the sentence, so it is a placeholder now and
each language orders its own: `'Collect {n} {breed}'` against
`'{n} {breed} topla'`. Collect is thirty-five percent of every goal in
the game, so this was the most frequently read line in it.

The brand line under the logo was `Ev` — the word "home", on its own,
as a tagline. It is `Pati Evi` now, which is what the place would
actually be called.

Everything else held up: the level card's perk chips wrap onto two rows
in Turkish without spilling, the shop cards take the longer names, and
the settings sheet's three-way light control still gets its own line
where it needs it.

## Eighteen type sizes

A count of the stylesheet found eighteen distinct `font-size`
declarations, thirteen of them inside a six-pixel range: 9, 9.5, 10,
10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15. That is not a scale.
It is a series of separate decisions that happened to land near each
other, and the reason two captions on the same screen were never quite
the same size.

Seven steps now — nano, micro, small, body, title, h2, hero — as tokens,
with every declaration snapped to the nearest. Nothing moved more than a
pixel and a half, so this is not a redesign; the point is that a caption
is now the same size as every other caption, and adding one later means
choosing a step rather than inventing a number.

Two things it turned up on the way past: the third marker on the star
track sat centred on the end of the bar, so half of it hung off the side
of the screen, and the lamppost on the lane was a hairline post under a
pale trapezoid — two thin shapes the colour of the sky behind them,
which read as a broken picture rather than a lamp. The post has a base
and a taper and the shade has a dark rim now, so its silhouette survives
being forty pixels tall on a green field. The trees come in two forms
instead of one, because a lane lined with a single silhouette repeated
at three sizes reads as a tiled background.

## Half a board of crates read as a hole

The crate is carefully made: four planks with seams and grain, two
knots, a diagonal brace, iron corners with nails, splits and a chipped
corner that only appear on the last hit point, and an iron band across
the middle so a two-hit crate is a different *shape* and not merely a
different brown.

At forty-two pixels, on a level where half the cells are crates, none of
that helped. Two things were wrong:

- **Its brown was the well's brown.** The board's well is `#6B563A` and
  the crate was `#A97B4C`, which is a slightly different shade of the
  same thing. With no rim of its own, the crate's gradient ran straight
  into the board behind it, so a wall of crates had no silhouettes and
  read as a hole in the middle of the level.
- **Ten grain lines at that size is hatching, not wood**, and a
  seven-percent-wide diagonal brace was the loudest mark on the tile —
  it read as a strike-through.

Lighter wood, a defined dark edge, five grain lines instead of ten, and
a quieter brace. Nothing was removed; the drawing is the same drawing at
a size where it is legible.

## A hint that points somewhere worth going

The board offers a hint after five seconds of stillness, which was the
right idea executed as `pick(allMoves(B))` — a uniformly random legal
swap.

A player who has stopped for five seconds has stopped because they
cannot see anything. Ringing a plain three while a five sits two rows
down is worse than no hint at all: it tells them that what they could
not find was all there was.

Every legal swap is now scored — how long the run is, with four and five
worth more than the one extra tile they clear because they make
specials, and anything that lands on mud, or beside a crate, or on a
colour the level is asking for, worth more again. Two specials together,
or anything involving a rainbow, beats every ordinary match.

The scoring tries each swap on the live board and undoes it, so the undo
is in a `finally`: a hint that throws halfway through would otherwise
leave two tiles transposed with no move having been made. The test
checks both halves — that the hint is the highest-scoring move available
on ten levels, and that the board is byte-identical afterwards.

Sixty-odd swaps, once, five seconds after the player went quiet.

## Making it something you keep on your phone

The input layer was already right for a phone and had been all along:
pointer events with capture so a drag survives the finger leaving the
canvas, `touch-action: none` on the board, `overscroll-behavior: none`
so there is no pull-to-refresh to lose a level to, a fixed layout,
`viewport-fit=cover` for the notch, and swipe-to-swap at a threshold of
`max(12, cell × 0.34)` alongside tap-then-tap. Driven with a real
finger through Chrome's touch emulation on a Pixel 7: a tap selects, a
swipe spends a move, no errors.

What was missing was everything that makes it an *app* rather than a
page you happened to open.

**An icon drawn by the game.** `tools/icon.js` opens the built game,
calls its own `drawLogo()` into a 512px canvas and writes the PNGs, so
the thing on the home screen is drawn by the same code as the thing in
the top bar. There is a maskable variant with the mark inside the middle
56%, because Android crops to a circle on some launchers and a squircle
on others, and a 180px one for iOS.

**A manifest and a service worker**, as sibling files. They only exist
where the game is *served*; opened as a single file both simply 404, the
registration is wrapped, and nothing changes. Where they are served, the
game installs to the home screen, opens standalone with no address bar,
and locks to portrait.

**Offline, including the typefaces.** A service worker does not control
the page that installed it, so on the visit that installs this one the
fonts are never requested through it and never land in the cache — a
player who installed the game and then lost signal would get the
fallback stack on their first real launch. The worker fetches the Google
Fonts stylesheet on activation and pulls in the seven woff2 files it
names. Measured by cutting the network and reloading: boots, save
intact, `Grandstander` resolved, no errors.

**The strip above the top bar.** `theme-color` is set from the game's
own `--bg` and updated whenever the theme changes, so a dark game does
not sit under a cream status bar.

**Double-tap zoom.** iOS reads two taps inside 300ms as a zoom, which on
a board of 42px cells is an ordinary pair of matches.

`node test/mobile.js` guards the parts that rot quietly — an icon
renamed, a declared size that no longer matches the file's actual IHDR
header, a shell entry that no longer exists. The browser's response to
any of those is to silently decline to offer the install, which nobody
would notice for months.

## What a phone actually asks for

Three things came out of driving the built game on an emulated Pixel 7.

**Landscape.** Turned sideways, the board is height-constrained: it
collapsed to 204px with 22px cells, floating in a wide empty field with
most of the screen unused. That is not a landscape layout, it is the
portrait one apologising. The manifest asks for portrait when the game
is installed; in a browser tab it can only ask nicely, so it does —
gated on `max-height: 520px`, so a tablet, which has the room, is left
alone.

**The effects layer had no idea how the device was coping.** The game
loop clamps its timestep to 50ms so the physics cannot tunnel, which
means a phone having a hard time runs in slow motion rather than
breaking — and also that the game never notices. `FX.load()` is handed
the real gap before the clamp; a device that is not keeping up gets
bursts scaled down to a third, and recovers on its own. Nothing changes
on hardware that can afford it and there is no setting to find.

**A phone in a pocket was still running a game loop.** Hiding the tab
stopped the music and saved the game, but left both render loops going.
The browser throttles rAF for a hidden tab, but throttled is not
stopped, and an installed app spends most of its life in the background.
Stopping them also fixes the first frame back: both loops take their
timestamp when they start, so one left running across ten minutes in a
pocket wakes with ten minutes to account for.

### On measuring a phone from a desktop

Chrome's CPU throttling is a poor model of a slow device and it is worth
writing down why, because the numbers it gives are inviting.

Timing a *synchronous* loop under it is meaningless: the throttler pauses
the main thread in slices, and those pauses land inside the loop. Measured
that way an unthrottled 1.2ms frame became 25ms at 4× and 249ms at 6× —
a 200× penalty for a 6× setting.

Counting real `requestAnimationFrame` frames is honest, and gives 60fps
unthrottled, 20fps at 4×, and 2fps at 6×. But the step from 4× to 6× is a
cliff rather than a slope, which is a property of the throttler and not
of any real phone. What the measurement does say, and this part is
trustworthy, is that under main-thread pressure it is the **baseline
board render** that dominates and not the particles: with the effects
switched off entirely the numbers barely move. A relayout storm was the
obvious suspect and was ruled out — zero calls to `layoutBoard()` across
two seconds at every rate.

## What the phone says

Haptics are the one channel a phone has that a desktop does not, and
they were carrying four events: a swap, a best chain, the ability, and a
win. Two things were wrong with that.

**A refused swap felt exactly like an accepted one.** `buzz(8)` fired
before the board had decided whether the move was legal. That is the
single moment a player most needs telling apart, and with the sound off
it was the only signal available.

**The most common event in the game said nothing.** Tiles clearing —
the thing you do more than anything else — had no haptic at all.

There is a vocabulary now, in `HAP`, so the same event feels the same
everywhere and the difference between two events is a decision rather
than an accident: a tick for picking a tile up, a slightly firmer one
for a swap, a stutter for a refusal, a tap for a clear scaled by how
much went, a rise for a chain, a knock for something breaking rather
than matching, a tick per star, and a longer shape for a win and a loss.

Everything that can fire repeatedly goes through `buzzOften()`, because
a cascade calls `resolveBoard` every hundred and forty milliseconds and
a motor held on for the whole of one is a buzz rather than a series of
taps — unpleasant in the hand and rude to the battery.

Measured by stubbing `navigator.vibrate` and playing both moves: a
refusal is `[15, 45, 15]`, an acceptance is `9` and then `12`.

### A test harness that was testing yesterday's build

Chasing that test turned up something worse. `test/integration.html`
holds the game in an iframe with a static `src`, and the frame caches
that document on its own — independently of whatever reloaded the suite
page. A new export on the debug handle came back "is not a function"
while sitting plainly in the file.

Which means any run made shortly after a rebuild may have been checking
the previous build. The frame is now given its source with a timestamp
on every run.

## What "installable" actually means here

Worth being exact, because the answer differs by how the game is handed
over, and only one of the two columns is a real app.

| | one file, nothing beside it | served with its siblings |
|---|---|---|
| plays, touch, haptics | yes | yes |
| iOS: add to home screen | yes | yes |
| iOS: with the right icon | yes, drawn at runtime | yes |
| standalone, no address bar | yes | yes |
| portrait lock | yes | yes |
| Android: offers to install | **no** | yes |
| works with no signal | **no** | yes |

The manifest and the icons can be rebuilt at runtime when the files are
missing — the same `drawLogo()` that paints the top bar, into a canvas,
out as a data URI, wrapped in a blob for the manifest because a blob URL
is same-origin and a data URI is not. That costs nothing when the real
files are there and nothing in the file when they are not.

What it cannot do is offline. **A service worker has to be fetched from
a real same-origin path**; there is no way to register one from a blob,
and Chrome will not offer to install a site that has none. Offline and
the Android install prompt both need the game to be *served* rather than
opened, and that is the honest limit of a single file.

So: the format is complete in the code and verified in both shapes, but
a phone can only install it from somewhere that serves `index.html`,
`manifest.webmanifest`, `sw.js` and `icons/` together. GitHub Pages does
that for free — on a public repository.

## The animals on the board are the animals you keep

This is the sentence the whole game is built on, and it was not true.

Every player saw the same six stock breeds, in the same six slots, in
the same six colours, forever. The pet sat on a rail beside the board
handing out buffs — and you could have replaced it with a power-up meter
and lost nothing at all. Adopting was a change of portrait. That is why
the game read as a match-3 with pets painted on it rather than a game
about pets: the premise was decoration.

**A level's tile types are slots now, and a cast says who stands in
each.** Your own come first, in the order you took them in; the rest of
the lane fills the slots behind them. So a player with one pet plays a
board with one friend and five strangers on it, and the board fills with
their own as they go — and the face on the tile is *their* pet, in the
coat they chose for it at adoption, not the breed's stock coat. Two
players on level 12 are now looking at two different boards.

The first attempt got this half right and looked wrong: the colour and
the silhouette stayed with the slot while the animal moved, so a Pug
turned up on an orange circle. Identity follows the breed instead — a
Pug is a pink clover on every board there has ever been. That costs
nothing in readability, because the cast is a *permutation*: all six
colours and all six shapes are still on the board and still unique. What
changes is which breeds are there at all.

Three invariants hold it up, and `test/integration.html` checks each:

- **The cast is a permutation.** Anything else loses a breed from the
  game or shows one twice.
- **A slot is painted by whoever is in it**, so colour and animal never
  disagree.
- **The number of types a level offers does not move.** Every difficulty
  figure in this project was measured against that number, and the
  engine compares type indices and has never known what a breed is — so
  the four curves are untouched by this, and measured after the change
  they are: 72% / 84% / 70% / 81%.

The charge meter needed one correction: it wanted the pet's breed index,
which is no longer the slot that breed is standing in.

## The bug hunt

`node tools/hunt.js` is the wide net: it drives the built game on an
emulated phone through every screen, every shop tab, every sheet,
thirteen levels with real moves, both languages, both themes, and an
adoption mid-flight — collecting page errors, console errors, failed
requests, and a set of invariants re-checked after every step (no NaN
positions, no tile type above the level's maximum, the cast still a
permutation, the save still serialisable, no stat out of range).

Four things came out of it and the two tests written alongside.

**The basket held the wrong animal.** `paintPup` resolves through the
cast now, and one caller was still handing it the pet's *breed index*
where a *slot* was wanted. With pets `[Pug, Sable]` the cast is
`5,2,0,1,3,4`, so slot 5 is a Siamese — a player walking a Pug saw a
Siamese in the basket.

**`breed is not defined`.** A blind find-and-replace put `tilePath(c,
breed, …)` into `drawTileFx`, where no such variable exists. It threw on
every board carrying a special tile. This is exactly what the wide net
is for: the suites did not touch that path.

**The pet you walk with was not always on the board.** A five-type level
draws the first five slots, so with six pets the sixth stood in a slot
nothing ever drew — you could take that pet down the lane and its own
face was absent, while the charge meter, which wants the slot its breed
stands in, quietly fell back to slot 0 and told you to match somebody
else's pet. The walker leads the cast now, which makes it impossible to
arrange and means switching pets visibly changes the board.

**An ability refilled the meter that paid for it.** Firing costs no
move, and the ability's own clears were charging the meter through the
ordinary path — a grown chorus taking out three crosses handed back
**76%** of its own cost, and a luckier board could have handed back all
of it. You charge the meter by playing, not by spending it.

Two of the four were found by a new test — `every breed ability fires
and leaves the board playable` — which fires all six on a level carrying
crates, mud and baskets and then insists the board is still a board.
Six abilities, the single mechanic that puts the pet's hand directly on
the tiles, and until now the largest thing in the game with no test at
all.

For the record, two failures that test reported first were **mine, not
the game's**: a crate occupies its cell instead of holding a tile, so
"no tile here" is not a fault; and asserting the meter reads zero
afterwards is wrong once ordinary play refills it.

## Designing the run instead of rolling it

Sixty levels were authored by hand and then measured. Everything after
them — which is most of what anybody plays — was generated by rolling
parameters from fixed constants:

```js
const moves = (GEN[key].moves || 28) + (tier % 2);
```

That line is the whole problem. No level had an intended difficulty, so
the run had no shape. It held inside its 55–88% band because the
constants had been tuned in aggregate, but inside the band it was noise:
two hundred levels of the same thing, at random, forever.

A run wants a rhythm. Relief after a hard one, so the player is allowed
to feel good; a build across the middle; a gate at the end of the block
that has to be earned. The gate is the level people remember and the
relief is what makes them try it again. So there are now four pieces
where there was one constant.

### 1. What each level is meant to feel like

`src/js/11-design.js` says it outright: a ten-level block, an eased
decline from 82% down toward 63% over the first couple of hundred
levels, and a fixed rhythm laid over it — `+13%` relief, a build, `+5%`
breather in the middle, a run-up, and `−15%` at the gate. A little
jitter so the pattern is felt rather than counted, clamped to 45–92% so
nothing is ever certain or impossible.

### 2. How a level answers its move budget

`node test/calibrate.js` holds a level fixed and varies its moves,
measuring the clear rate at eight budgets, per goal kind, over 4,800
games. The curves are not the same shape at all:

| | 0.55× budget | 1.0× | 1.50× |
|---|---|---|---|
| score | 3% | 65% | 99% |
| collect | 5% | 76% | 100% |
| mud | 32% | 75% | 99% |
| crate | 38% | 81% | 95% |
| rescue | 33% | 64% | 78% |
| bramble | 25% | 49% | 72% |

Two of those ceilings are design facts worth knowing. **A rescue tops
out near 78%** however many moves it is given — two baskets have to be
walked the length of the board and that takes what it takes. **A bramble
patch tops out near 72%**, because it grows back while you cut it. So
neither can ever be a relief level, and the generator now picks a kind
that can actually reach the target rather than rolling one and hoping.

More moves can never make a level harder, so any dip in a measured row
is sampling noise; the rows are made monotone by carrying the running
maximum forward before they are inverted.

### 3. The generator solves for its target

`targetClear(n)` says what the level is for; `budgetFor(kind, want)`
reads the response curve backwards and answers with a move budget. What
the budget cannot reach — a mud goal stays winnable at half its moves,
because it is a share of a map that has not changed — is carried into
the work instead.

### 4. Whether any of it worked

`node test/curve.js` plays the run and compares it against its own
design. That is the acceptance test, and it is in `run-all.js`.

### Two things measurement caught that reasoning had not

**The calibration was circular.** The first pass measured the response
on levels the *old* generator had built, then the new generator changed
those levels — so the curve described something that no longer existed,
and levels overshot by thirty points. `levelDef(n, ref)` builds a level
with no target applied at all; calibration plays those, so the curve is
anchored to a fixed point instead of to itself. Mud's reachable floor
moved from 48% to 32% once the circle was broken.

**A goal counted cells, and cells are not work.** Two mud levels with
the same count and the same budget measured at 21% and 100%. The
difference was *where* the mud was: a corner cell has two neighbours
instead of four, so a match must arrive along one of two lines rather
than one of six. Cells are weighted by how awkward they are to reach
now (1.9 in a corner, 1.35 on an edge, 1.0 inside), the player is
assumed to take the cheap ones first, and the goal is an absolute
amount of work rather than a share of whatever the map happened to hold
— which the arrangements were varying two to one on their own.

### Where it landed

```
average miss      13%   (sampling noise alone is 13%)
bias              +5%   centred
gates             70% cleared over 5 of them
relief after one  98%
the rhythm is     28 points wide
```

The miss equals the sampling noise, which is as close as this test can
see: at fourteen games a level the model's own error is no longer
distinguishable from the coin. The run is five points easier than
drawn — a real residual, and the honest reading is that the maps still
carry difficulty the model does not price, beyond the corner weighting.

One correction to the test itself while getting there. It flagged
sixteen levels as "free" for clearing 100%, which at fourteen games has
a lower bound near 77% — that is evidence of fourteen games, not of a
free level. Calling a level out now needs the sample to carry the claim:
two standard errors, the same figure the report already quotes as its
own noise.

A note on the older verdicts: `test/ai.js` still labels levels TRIVIAL
and BRUTAL against a flat band, and for the generated run those labels
are now meaningless. A relief level *should* read as trivial — that is
what it is for. The band check stays for the handcrafted lane, where it
is still the right question.

## The animal that was never alive

The scene layer has a function called `drawPetLive`. It applies a rig —
breath that deepens when the animal sleeps, a blink that closes over
about a sixth of a second and occasionally doubles, a tail that swings
like a pendulum and swings faster when the pet is happy, an ear that
flicks, heavy lids when it is tired, and a gaze that wanders on its own
or follows a pointer if one is nearby. Below that it draws the mood: a
bowl in a thought bubble when the animal is hungry, a ball when it is
bored, smudges and a fly when it is dirty, Zs when it sleeps.

None of it had ever run.

`drawPetLive` is called from `drawRoom`, once, guarded by `if (o.pet)`.
`drawRoom` has exactly one caller — the room — and the room passes it a
theme, a furniture list and a floor ratio, and no pet. It draws its own
animal afterwards, with a single-frame blink flag, two plain sine waves
for breath and tail, and eyes pointed along the direction of travel.

So `petRig`, `rigStep`, `drawZs`, `drawThought`, `drawGrime` and every
mood ornament in the game were unreachable, and had been since the room
was written. The tell was in the string table: `mood_hungry`,
`mood_bored`, `mood_dirty`, `mood_tired`, `mood_lonely` and `mood_happy`
were the only six keys nothing in the source asked for.

That turned out to be a false positive — `moodLine` builds the key as
`T('mood_' + moodOf(p))`, so those six are shown constantly and appear
nowhere. The check was wrong and has been taught about key families. But
looking for the answer found the real one, which was worse: the mood was
in the text under the buttons and nowhere else. A starving animal and a
delighted one were the same picture.

The room keeps its own state machine. It is the better one — grooming,
stretching, shaking, staring at you, walking to somewhere it decided to
go, a beat of attention when you come back into the room. What it did
not have is everything an animal does without deciding to, and that is
what the rig is for. So the rig is stepped in the room now and feeds
breath, blink, tail and gaze, the room still overrides all four when it
is deliberately doing something, and the ornaments are drawn.

Three things had to be fixed before it read right.

**The gaze was too small to see.** `drawEye` moved the iris by `.22` of
the eye radius. The iris is `.84` of the eye and the eye is clipped, so
there was room for far more travel — and travel past the rim is not an
error, it is what an eye looks like when it looks hard at something. At
`.22` the pet appeared to stare through you whatever it was looking at.
At `.30` you can see where it is looking, which is the whole point of
wiring a gaze to a finger.

**Dirty was invisible on a dark coat.** The smudges were drawn in brown
at a third opacity. That is a smudge on a cream retriever and nothing at
all on a black cat, so sable coats went unwashed because the game had no
way of saying they were dirty. The smudge takes the opposite side of the
coat now, and the fly flies close enough to the head to belong to the
animal instead of to the wall.

**The hearts came twenty-six at a time.** The happy ornament fired on
`Math.sin(t * .8) > .985`, which reads like "every so often" and is not:
the sine stays above that line for about four tenths of a second, which
at sixty frames is twenty-six hearts in a burst, every eight seconds. It
rendered as a red smear above the pet's head. It is a timer now, in both
copies of the line — the scene layer had the same fault written as
`> .96`.

`tools/moods.js` renders the room once per mood so this can be looked at
rather than argued about, and it holds the animal still for the camera:
two of the first three frames landed mid-groom with the eyes shut, which
says nothing about the mood it was supposed to be showing.

## Designing the lane instead of inheriting it

The endless run got a designed shape. The sixty handcrafted levels in
front of it did not, and they are the ones almost everybody plays.
Measured, this is what the authored lane was:

```
L1-10  84%   L11-20 71%   L21-30 65%
L31-40 66%   L41-50 65%   L51-60 73%
```

A bathtub. Easy at both ends, a flat sixty-five percent grind for thirty
levels through the middle, seven levels under forty-five percent
scattered through it and ten that could not be lost. The hardest stretch
of the whole game was levels 21 to 50, and then it got *easier* just as
the designed run took over at seventy-eight. Whoever quit this game quit
somewhere in that plateau, and the plateau was not a decision anybody
made — each level had been given whatever budget felt right at the time.

### One curve, three rules

The lane and the run are one descent now, and the rules turned out to be
the same rules written twice:

```
the gate is every tenth level             n % 10 === 0
the beat is where you are in the block    RHYTHM[(n - 1) % 10]
the ease descends and never lands
```

The run's own reading — nine levels past the handoff, then every ten —
picks exactly the same levels, because the lane is sixty long. Level 60
is a gate and level 61 is the relief that follows one, so the handoff
lands on a beat rather than across one.

The gates were also being drawn in one place and not the other: the map
computes `isGate` itself, the level card reads `def.gate`, and an
authored level carried no such flag. The same level was a gate on the
map and an ordinary level on its own card. It is stamped on the way out
of `levelDef` now.

### Measuring became cheap enough to do

One solver game takes about half a second. A sweep that asks a real
question — sixty levels, several candidate budgets, enough games each
for the answer to mean anything — is twenty thousand games and over two
hours on one core. That cost is the honest reason these levels were
tuned by feel for so long.

The machine has twelve cores and no tool in this project had ever used
more than one. `test/_pool.js` hands the games out to all of them.
Everything below is a consequence of measuring being minutes instead of
an afternoon.

### The curve has to fit the material

The first attempt drew a line from ninety-five percent at level one down
to seventy-eight at the handoff and asked each level to meet it with a
move budget. Some could not. Level 20 wanted eighty percent and stopped
at seventy-five with fifty-three moves against an authored thirty.
Handing a level seventy percent more moves does not make it easier; it
makes it longer, and a long level that is still lost is the worst of
both.

So `test/envelope.js` measures what the lane *can* do before deciding
what it should: every level at four budgets either side of its authored
one, which is the widest band that leaves it recognisably the level
somebody wrote. Twenty-one of sixty topped out below eighty-five percent
at any budget in that band.

Fitting a single formula inside that envelope produced a lane running
from eighty-four percent to sixty-six — an eighteen-point descent over
sixty levels, which is a plateau with a slope drawn on it. The formula
was not the answer.

### What actually makes a level a wall

Six levels could not be cleared even seventy percent of the time with
thirty-five percent more moves. All six were the same shape:

```
level 20  rescue 2 + score 9500                    ceiling 54%
level 35  crate 12 + rescue 2                      ceiling 67%
level 49  rescue 3 + score 11000                   ceiling 63%
level 52  bramble 24                               ceiling 63%
level 53  crate 12 + collect 28                    ceiling 63%
level 59  rescue 2 + 2 collects                    ceiling 67%
```

Rescue as a kind averages a seventy-six percent ceiling on its own —
baskets have to be walked the length of the board and that takes what it
takes. Stack a second goal on top and it drops to the fifties. Dropping
exactly one basket:

```
level 20   41% -> 70%
level 35   59% -> 90%
level 49   53% -> 65%   (three baskets to two)
level 59   63% -> 83%
```

Shrinking the *other* goal instead barely moved any of them. Shrinking a
bramble goal moved nothing at all: level 52's clear rate was identical
with its goal halved, because what makes a bramble level hard is the
regrowth, not the count. A bramble goal is not a difficulty lever and
must not be used as one.

Levels 20, 35 and 49 are one basket lighter. Level 59 was left alone —
it sits at the run-up before a gate, where sixty-seven percent is what
it is supposed to be. After those three edits only four levels in the
lane still cap below seventy percent, and all four are rescues carrying
a second goal, and all four sit at a gate or the run-up into one. The
rule explains every hard level in the lane.

### Fitting the rhythm to the levels

Every block of ten keeps its shape, but the beats are handed out by what
each level can carry rather than by where it sits. The tenth level is
the gate and the first is the relief that follows one — those two are
pinned, because the map and the level card say so. The eight in between
are sorted by measured headroom and given the eight remaining beats in
rank order: the most room gets the biggest gift, the least gets the
run-up.

So a bramble patch that cannot be a gift stops being asked to be one,
and a collect level with a hundred-percent ceiling takes the gift
instead. The player still feels a block that gives, builds and then
asks.

What comes out is a number per level, written into the table as `want`.
Design intent as data rather than as a formula, which is how it can be
read, argued with, and overridden for one level without moving anybody
else. `targetClear` reads it for the lane and falls back to the curve
for a level nobody has measured yet.

### Stars, measured

Move budgets came from each level's own response curve and then a
correction round: a budget interpolated between two measured rungs is a
guess, and on a level where one more move buys a whole extra cascade it
is not a good one. Levels missing by more than eight points were
corrected against their own local slope and played again.

Star thresholds were authored numbers nobody had checked. They are the
seventieth percentile of the scores of *winning* runs at the chosen
budget now, so three stars is earned by roughly the best third of the
games that were won at all, and the other two thresholds fall out of it
at .8 and .55 as they always did.

### Where it landed

```
average miss      4%     (sampling noise alone is 6%)
the lane          97% at level 1, 63% at level 60
gates             70% cleared
relief after one  89%
the rhythm        19 points wide
```

The average level now sits closer to its intent than the measurement can
resolve. Fifty-six of sixty levels changed budget, fifty-eight changed
star thresholds, and every one of them has a stated target for the first
time.

## Three sheets at once

Clearing a level that grew the pet and won a badge ran this:

```
showWin()                      the win sheet, open until it is tapped
setTimeout(stageUpModal,  900)
setTimeout(badgeModal,   2000)
```

The delays are measured from the win, not from the player. The win sheet
stays up until somebody dismisses it, so nine hundred milliseconds later
the stage-up sheet arrived on top of it, and eleven hundred after that
the badge sheet arrived on top of both. All three were legible through
each other, because a veil is a translucent scrim and stacking two of
them just dims the first sheet slightly.

The game already had `sheetIsOpen()`. Exactly one call site in the whole
codebase used it.

Sheets queue now. A sheet opened while another is up is built and
attached immediately — so a caller can wire up its buttons and paint its
canvases exactly as before, and the stage-up animation still gets a
canvas with layout — but it is transparent, takes no taps, and holds no
focus until the sheet in front of it closes. Then it fades in on its own.
The timers above are left alone: they now decide nothing except the
order things joined the line.

Two things went wrong on the way in, and both are the kind that only
show up when the change is run rather than reasoned about.

**Every dialog queued behind itself.** The new veil was appended to the
document and *then* asked whether a sheet was already open.
`sheetIsOpen()` reads the DOM, so it found the veil that had just been
added, concluded something was in front, and put the sheet in a line
behind a sheet that was never going to appear. The flag is set before it
joins the document now.

**A veil can leave the document without being closed.** The test harness
clears sheets by removing the elements, and screen changes can too. A
queued sheet promoted after that would have taken focus into something
nobody could see. It checks that it is still connected, and passes the
screen to the next one if it is not.

The failure that found the first bug was a test that has been in the
suite for a long time: *a dialog takes the keyboard with it*. It opens
the settings during a level and asserts the focus moved. It said the
focus had gone to a canvas.

## The walk home

A third of the play screen is a band of grass with a hedge, a house, a
lane and nine paw prints. It was composed rather than laid out, which
was the point of drawing it — but it was a picture. Nothing in it ever
changed, on a screen where the player spends every minute of the game.

Meanwhile the game's whole idea is walking an animal home, and the only
place progress was stated was a row of counters at the top.

The prints are the walk now. They run from the tray by your hands up the
lane toward the house, and they are laid as the goals come in: the ones
behind the walk are pressed into the path at full weight, the ones ahead
are barely there, and the one being made is a little heavier than the
rest. Fourteen of them rather than nine, because nine steps is a coarse
thing to measure a whole level with.

Nothing new is drawn and nothing animates. It is the picture that was
already there, told in order.

The cost is a repaint of the lane canvas — a full ground gradient, a
hedge, a bent path and about two hundred bits of grit and grass — and
that is far too expensive to do on a cascade tick. So `syncGoals`
quantises the walk to its fourteen steps and repaints only when the step
changes: at worst fourteen repaints in a level, most of them while the
player is watching tiles fall anyway. Measured after the change, the
frame budget is *better* than before it, which says the repaints land
outside the frames that were being measured.

Also on this screen, and for the same reason — a screen exists to let
you do something and should put that first — the Family screen used to
sit the adopt card underneath nineteen trophy cards. Bringing another
animal home is what that screen is for. It comes second now, after the
family it would join, and the shelf comes last.

## Zeynep'a

The Turkish string table is careful writing. Moods read like somebody
watching an animal rather than like a translation — *Raftan üç şey
düşürdü bile*, *Derin bir hakarete uğradı. Mis gibi kokuyor.* And nearly
every line that mentions the pet keeps its name in the nominative, which
in Turkish is the only way to use a name you did not choose:

```
{name} büyüdü!          {name} ile bağ          Hoş geldin {name}
```

One line broke the rule:

```
Hazır — {name}’a dokun
```

Turkish puts the case on the end of the noun, and the dative agrees with
the last vowel: a, ı, o, u take **-a**; e, i, ö, ü take **-e**. A name
ending in a vowel takes a buffer *y* first. So that line was right for
Marlow and wrong for Zeynep'a, Şeker'a, Gül'a and Ayşe'a — and the name
is whatever the player typed on the fourth screen of the game.

`trDative()` is twelve lines and gets it right:

```
Marlow → Marlow’a     Zeynep → Zeynep’e     Şeker → Şeker’e
Ayşe   → Ayşe’ye      Mila   → Mila’ya      Ali   → Ali’ye
```

The English string is untouched and both tables still carry the same
placeholders, because what changes is the value passed in, not the
sentence.

## Verdicts against an intent

`test/ai.js` printed a verdict per level: BRUTAL under 34% cleared,
TRIVIAL over 96%. Those were reasonable when no level had an intended
difficulty. Against a designed curve they are nonsense — a gate is *for*
being near sixty and a relief is *for* being near ninety-five, and
calling the relief trivial is calling the design a bug.

It reports the distance from the intent now: the target beside the
measurement, the average miss, the bias, and which levels are more than
ten points plus two standard errors away from where they were aimed. The
absolute bands survive only where they still mean something on their
own — a level nobody can clear and a level nobody can lose are faults
whatever they were aimed at, so those thresholds moved to 18% and 99.5%.

Measured over levels 18-24 at sixteen games each: average miss 6%, bias
+2%, nothing off its mark.

## Eight frames of overflow

A canvas is sized in pixels by `fitCanvas`, and the resize handler is
debounced by 140ms so that dragging a desktop window does not re-lay out
the whole game on every pixel of the drag. Those two facts together mean
that for about eight frames after a phone rotates — or a keyboard opens,
or an app goes into split screen — every canvas on screen is still
carrying its old width and hangs off the side.

The suite caught it as a flake: *nothing spills or is cut off, on a small
phone* failed about one run in three, and only ever named `CANVAS`. A
test that fails intermittently is usually accused of being a bad test.
This one was reporting a real race and reporting it honestly; it just
happened to be racing against something the player only sees for an
eighth of a second.

The fix is one line of CSS and cannot fail:

```css
canvas{ max-width:100% }
```

The canvas is then briefly drawn at a resolution slightly wider than it
is displayed, which is invisible, instead of overflowing, which is not.
Four consecutive runs clean afterwards.

Leaving the debounce alone was deliberate. Removing it would fix the
symptom by making every drag of a desktop window rebuild the map, the
sprite cache and the palette — a real cost, every frame, to avoid a
cosmetic fault that lasts an eighth of a second.

## A gate you can walk through

Every tenth level is a gate. The map said so with a dashed ring around
the node — which is a label, not a place. The lane itself had no idea
anything happened there: three hundred levels of the same five props,
with nothing to walk past and remember.

So there is a gate in the hedge now, at the end of every block. It
stands shut while the level in front of it is unbeaten and swings open
once it is cleared, so scrolling back down the lane shows every gate you
have come through standing open behind you.

Two goes at drawing it, both wrong for the same reason and worth writing
down.

**An open gate cannot be a rotated gate.** The first version hinged the
panel and rotated it forty-five degrees, which is what a gate does. In a
flat elevation like this map it reads as a ladder falling over. Swung
*toward* the viewer it foreshortens instead: same gate, narrow, still
upright, still on its hinge, and instantly legible.

**It cannot borrow the fence's colours.** The fence is drawn in cream at
a hairline weight and reads perfectly, because a fence is a repeated row
of pales — the eye reads the texture, not the line. One gate at that
weight is three pale strokes on green and reads as nothing at all. In
wood, one size up, with the ground shadow every other prop on this lane
has, it reads as a gate from across the screen.

## A cat called "<3"

A pet's name reaches the document in nineteen places: four interpolated
straight into `innerHTML`, and fifteen through `T()`, which substitutes
into a template string. None of them escape anything.

All three places that make a pet already run `cleanName` over what the
player typed, so nothing dirty reaches the game today. But `makePet`
itself kept whatever it was handed, and `healPet` — which reads a save
back off the disk — trimmed and truncated without stripping anything. A
save from an older build, or one somebody edited by hand, walked
straight through.

And `<3` is two characters and a completely ordinary thing to call an
animal. Unescaped it opens a tag that swallows whatever follows it,
which is how somebody breaks their own family screen by being fond of
their cat.

Both now go through `cleanName`, which is one line each and cannot be
forgotten the way nineteen escapes can. What it does, measured:

```
'   '          → 'Marmalade'   (the breed name, not three spaces)
''             → 'Marmalade'
'A' x 80       → 'AAAAAAAAAAAAAA'
'<b>bold</b>'  → 'bbold/b'
'Zeynep'       → 'Zeynep'
```

A name is a short label, and the one place it is made is the place to
make it safe.

## Two models, one game

The visual direction is Gemini's and the game feel is mine. That split
only works if the handoff is a contract rather than a conversation, so
it is four files and a loop.

### What Gemini can and cannot hand over

Not art. There are no image files in this game and there will not be,
and the reason is arithmetic rather than pride. The player picks a
breed, a coat and an eye colour, and *their* pet's colours appear on the
board tiles: six breeds by coats by eye colours by four growth stages by
six silhouettes by special states by two themes is thousands of sprites.
As drawings it is a few hundred lines of Canvas. And Day and Dusk
recolour everything at runtime from CSS custom properties, which a
raster sprite cannot follow.

So the handoff is **direction** — palette, proportion, shape language,
lighting, weight, spacing — and the drawing stays code. That is not a
consolation prize. Choosing the six tile hues is the highest-leverage
visual decision in the game, and it is exactly the kind of decision a
model that is good at images should be making.

The architecture happened to be ready for it: one `:root` block in the
stylesheet is the single source of truth, and `readPalette()` hands the
same values to the Canvas art at runtime. A palette change lands in one
place and reaches both the DOM and every drawn pixel.

### The loop

```
node tools/shots.js look      the built game, photographed
node tools/art-direct.js      Gemini judges it against design/DIRECTION.md
                              → design/critique/NNN.json
  ... I read the findings and build the ones that are right ...
node tools/art-gate.js        does it still play?
```

`design/DIRECTION.md` is the contract, and the interesting half of it is
the constraints: no image files, colour is gameplay, everything redraws
at 60fps on a phone, both themes always, contrast is enforced. A
director who does not know those proposes things that cannot be built,
and every round trip spent discovering that again is wasted.

Findings come back as structured JSON with required fields — screen,
element, problem, why, fix, severity, confidence. That schema is doing
real work: "the palette is warm and inviting" cannot be expressed in it.
Nothing is applied automatically. A finding is an argument, and some
arguments are wrong.

### The gate, which is the point

An art direction can break this game in ways a screenshot cannot show.

`tools/art-gate.js` runs the checks this project already had, in the
order that matters after a visual change: the palette, the strings, the
module graph, 39 checks in a real browser, the frame budget, and the
bug sweep. About three minutes. `--full` adds the difficulty sweep.

The one that had to be written new is `test/palette.js`, and it is the
one that matters most:

> The solver compares type indices. It has never once looked at a
> colour, so every clear rate in this README was measured by a player
> who cannot be confused.

Two tile colours moving closer together makes every board harder and
**nothing in the difficulty suite would notice**. So the palette is now
measured directly: every tile against every other tile, in normal vision
and under protanopia, deuteranopia and tritanopia, against a recorded
baseline in `design/palette-baseline.json`.

Verified by breaking it — moving Sable's purple toward Beagle's blue:

```
normal          beagle / void    37.6 -> 10.7    x below the floor
protanopia      beagle / void    24.4 ->  7.0    x worse than baseline
deuteranopia    beagle / void     6.6 ->  3.5    x worse than baseline
```

### What it found on the first run

A standing defect nobody had measured. With deuteranopia — the common
kind, about one man in sixteen — Beagle blue and Sable purple sit **6.6
dE apart**, which is to say a deuteranope cannot tell those two tiles
apart by colour at all. With tritanopia, Marmalade and Pug collapse to
5.2.

The board does not rest on colour alone: each tile carries its own
silhouette and those are always on, so the gap costs a deuteranope the
glance rather than the game. But it is a real gap, it predates all of
this, and moving one colour does not fix it — separating the purple just
makes Siamese and Pug the new closest pair. Six hues that stay apart
under three kinds of colour blindness is a design problem, which is
precisely what the loop above is for. It is the first standing question
in `DIRECTION.md`.

The test does not fail on it. Failing every run for a known gap nobody
is fixing this minute trains people to ignore the test. It fails on
regression against the baseline, and reports the gap as a note.
