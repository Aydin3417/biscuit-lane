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
loads the built game in an iframe and runs 34 checks, driving the real
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
