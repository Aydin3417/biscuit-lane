/* ============================================================
   10 — game data: breeds, abilities, goods, levels
   ============================================================ */

/* Tile / breed identities. Index === tile type on the board.
   Gem colour is fixed per type so the board stays readable no
   matter which coat a player picks for their own pet. */
const BREEDS = [
  {
    id: 'marmalade', species: 'cat', gem: '#F2843C', gem2: '#C85E1E',
    en: 'Marmalade', tr: 'Marmelat',
    enDesc: 'Ginger tabby. Opinionated.', trDesc: 'Sarı tekir. Fikirleri var.',
    fur: '#F0954B', fur2: '#D6742E', belly: '#FBE0C2',
    ear: 'triangle', face: 'cat', mark: 'tabby', pip: 'fish',
    eyes: '#7ABF63',
    coats: [
      { id: 'ginger', en: 'Ginger', tr: 'Zencefil', fur: '#F0954B', fur2: '#D6742E', belly: '#FBE0C2' },
      { id: 'cream', en: 'Cream', tr: 'Krem', fur: '#F3D9B0', fur2: '#DCBB88', belly: '#FDF2E1' },
      { id: 'smoke', en: 'Smoke', tr: 'Duman', fur: '#9AA4B0', fur2: '#77828F', belly: '#E2E7EC' }
    ],
    ability: 'pounce'
  },
  {
    id: 'beagle', species: 'dog', gem: '#4E9EDE', gem2: '#2F72AC',
    en: 'Beagle', tr: 'Beagle',
    enDesc: 'Nose first, questions later.', trDesc: 'Önce burun, sonra soru.',
    fur: '#C98B4E', fur2: '#9A6532', belly: '#F7EEDF',
    ear: 'droop', face: 'dog', mark: 'patch', pip: 'bone',
    eyes: '#5B3A22',
    coats: [
      { id: 'tri', en: 'Tricolour', tr: 'Üç renk', fur: '#C98B4E', fur2: '#9A6532', belly: '#F7EEDF' },
      { id: 'lemon', en: 'Lemon', tr: 'Limon', fur: '#E8CB92', fur2: '#C6A468', belly: '#FBF4E4' },
      { id: 'choc', en: 'Chocolate', tr: 'Kakao', fur: '#8A5A3B', fur2: '#5F3B24', belly: '#E6D3BE' }
    ],
    ability: 'dig'
  },
  {
    id: 'void', species: 'cat', gem: '#8E6FD6', gem2: '#6647B0',
    en: 'Sable', tr: 'Karagöz',
    enDesc: 'Two eyes in a dark room.', trDesc: 'Karanlıkta iki göz.',
    fur: '#3B3550', fur2: '#262238', belly: '#4E4768',
    ear: 'round', face: 'cat', mark: 'none', pip: 'moon',
    eyes: '#9FE86B',
    coats: [
      { id: 'ink', en: 'Ink', tr: 'Mürekkep', fur: '#3B3550', fur2: '#262238', belly: '#4E4768' },
      { id: 'tuxedo', en: 'Tuxedo', tr: 'Smokin', fur: '#33303F', fur2: '#1F1D28', belly: '#F4F1EA' },
      { id: 'blue', en: 'Russian blue', tr: 'Gri mavi', fur: '#6E7B93', fur2: '#4F5B70', belly: '#B9C4D4' }
    ],
    ability: 'shadow'
  },
  {
    id: 'retriever', species: 'dog', gem: '#F0C243', gem2: '#C39A20',
    en: 'Retriever', tr: 'Golden',
    enDesc: 'Loves you. Loves everyone.', trDesc: 'Seni seviyor. Herkesi seviyor.',
    fur: '#EBBE7A', fur2: '#C99A50', belly: '#FAEDD6',
    ear: 'flop', face: 'dog', mark: 'none', pip: 'star', tongue: true,
    eyes: '#5A3A20',
    coats: [
      { id: 'golden', en: 'Golden', tr: 'Altın', fur: '#EBBE7A', fur2: '#C99A50', belly: '#FAEDD6' },
      { id: 'red', en: 'Red', tr: 'Kızıl', fur: '#C87F45', fur2: '#9E5D2C', belly: '#EDD3B2' },
      { id: 'cream', en: 'Pale', tr: 'Açık', fur: '#F4E3C4', fur2: '#D6C09A', belly: '#FDF7EC' }
    ],
    ability: 'fetch'
  },
  {
    id: 'siamese', species: 'cat', gem: '#4FBF95', gem2: '#2E8E6B',
    en: 'Siamese', tr: 'Siyam',
    enDesc: 'Will tell you about it.', trDesc: 'Sana bunu anlatacak.',
    fur: '#EFDFC4', fur2: '#5C4736', belly: '#FBF3E4',
    ear: 'tall', face: 'cat', mark: 'points', pip: 'leaf',
    eyes: '#5FB8DC',
    coats: [
      { id: 'seal', en: 'Seal point', tr: 'Koyu uç', fur: '#EFDFC4', fur2: '#5C4736', belly: '#FBF3E4' },
      { id: 'blue', en: 'Blue point', tr: 'Mavi uç', fur: '#EDE9E2', fur2: '#6C7887', belly: '#FAF8F5' },
      { id: 'choc', en: 'Chocolate', tr: 'Kakao uç', fur: '#F0E0C8', fur2: '#7A5238', belly: '#FBF3E5' }
    ],
    ability: 'chorus'
  },
  {
    id: 'pug', species: 'dog', gem: '#EE7C97', gem2: '#C4506C',
    en: 'Pug', tr: 'Pug',
    enDesc: 'Breathes like a small kettle.', trDesc: 'Küçük bir çaydanlık gibi soluyor.',
    fur: '#E3C48D', fur2: '#3A3028', belly: '#F5E6C9',
    ear: 'button', face: 'flat', mark: 'mask', pip: 'heart', tongue: true,
    eyes: '#2E2419',
    coats: [
      { id: 'fawn', en: 'Fawn', tr: 'Bej', fur: '#E3C48D', fur2: '#3A3028', belly: '#F5E6C9' },
      { id: 'black', en: 'Black', tr: 'Siyah', fur: '#40382F', fur2: '#221D17', belly: '#574D41' },
      { id: 'apricot', en: 'Apricot', tr: 'Kayısı', fur: '#EFB985', fur2: '#3A3028', belly: '#F9DCBC' }
    ],
    ability: 'snuffle'
  }
];

const EYE_COLORS = [
  { id: 'green', hex: '#7ABF63' }, { id: 'amber', hex: '#E0A73C' },
  { id: 'blue', hex: '#5FB8DC' }, { id: 'copper', hex: '#B5623A' },
  { id: 'hazel', hex: '#8A6A3A' }, { id: 'grey', hex: '#8E98A6' }
];

/* ---------- abilities ---------- */
const ABILITIES = {
  pounce: {
    steps: [1, 2, 3], enUnit: ['tile', 'tiles'], trUnit: 'taş',
    en: 'Pounce', tr: 'Atlayış',
    enDesc: 'Lands on a goal tile and blows open everything around it.',
    trDesc: 'Bir hedef taşın üstüne atlar, etrafındaki her şeyi patlatır.'
  },
  dig: {
    steps: [4, 7, 10], enUnit: ['blocker', 'blockers'], trUnit: 'engel',
    en: 'Dig', tr: 'Eşele',
    enDesc: 'Tears through crates, mud and ice wherever they are.',
    trDesc: 'Kasaları, çamuru ve buzu nerede olursa olsun parçalar.'
  },
  shadow: {
    steps: [2, 3, 4], enUnit: ['rocket', 'rockets'], trUnit: 'roket',
    en: 'Shadow', tr: 'Gölge',
    enDesc: 'Leaves rockets behind on tiles you did not expect.',
    trDesc: 'Beklemediğin taşların üstünde roketler bırakır.'
  },
  fetch: {
    steps: [4, 6, 8], enUnit: ['tile', 'tiles'], trUnit: 'taş',
    en: 'Fetch', tr: 'Getir',
    enDesc: 'Runs off and brings back goal tiles from all over the board.',
    trDesc: 'Tahtanın her yerinden hedef taşları toplayıp getirir.'
  },
  chorus: {
    steps: [1, 2, 3], enUnit: ['cross', 'crosses'], trUnit: 'kesişme',
    en: 'Chorus', tr: 'Koro',
    enDesc: 'One long yowl clears a whole row and column.',
    trDesc: 'Uzun bir miyavlama koca bir satırı ve sütunu siler.'
  },
  snuffle: {
    steps: [4, 6, 8], enUnit: ['tile', 'tiles'], trUnit: 'taş',
    en: 'Snuffle', tr: 'Koklama',
    enDesc: 'Sniffs out tiles and turns them into what you actually need.',
    trDesc: 'Taşları koklayıp gerçekten ihtiyacın olan şeye çevirir.'
  }
};
/* extra moves a stage is worth, and the last word on it: this is the
   only unbounded reward the game had, and it retuned every level. */
const STAGE_MOVES = [0, 1, 2];
/* how a pet is built at each stage: overall size, then the squash that
   makes a young one squat. Applied in drawBody, about the floor line. */
const STAGE_BUILD = [
  { k: .80, sx: 1.07, sy: .94, head: .045 },
  { k: .91, sx: 1.03, sy: .98, head: .018 },
  { k: 1,   sx: 1,    sy: 1,   head: 0 }
];
const STAGES = [
  /* en/tr are the label; the phrase is what goes in a sentence */
  { id: 'baby', en: 'Kitten', enDog: 'Puppy', tr: 'Yavru', bond: 0,
    ph: 'a kitten', phDog: 'a puppy', phTr: 'bir yavru' },
  { id: 'young', en: 'Young', enDog: 'Young', tr: 'Genç', bond: 6,
    ph: 'a young cat', phDog: 'a young dog', phTr: 'genç' },
  { id: 'adult', en: 'Grown', enDog: 'Grown', tr: 'Yetişkin', bond: 14,
    ph: 'all grown up', phDog: 'all grown up', phTr: 'koca bir yetişkin' }
];

/* ---------- goods ---------- */
const FOODS = [
  { id: 'kibble', en: 'Kibble', tr: 'Mama', cost: 12, food: 26, joy: 2, art: 'kibble', enDesc: 'The everyday stuff.', trDesc: 'Günlük mama.' },
  { id: 'tuna', en: 'Tuna flakes', tr: 'Ton balığı', cost: 34, food: 46, joy: 9, art: 'tuna', enDesc: 'Opens a door across the whole house.', trDesc: 'Kapağı açılınca evin her yerinden koşarlar.' },
  { id: 'stew', en: 'Beef stew', tr: 'Etli güveç', cost: 62, food: 74, joy: 14, art: 'stew', enDesc: 'A proper dinner.', trDesc: 'Doğru dürüst bir akşam yemeği.' },
  { id: 'cake', en: 'Carrot cake', tr: 'Havuçlu kek', cost: 3, treat: true, food: 55, joy: 40, art: 'cake', enDesc: 'For a very good day.', trDesc: 'Çok iyi bir gün için.' }
];
const TOYS = [
  { id: 'yarn', en: 'Ball of yarn', tr: 'Yün yumağı', cost: 45, joy: 18, art: 'yarn', enDesc: 'Rolls under the sofa immediately.', trDesc: 'Anında kanepenin altına kaçar.' },
  { id: 'tennis', en: 'Tennis ball', tr: 'Tenis topu', cost: 70, joy: 26, art: 'tennis', enDesc: 'Comes back damp.', trDesc: 'Islak geri gelir.' },
  { id: 'wand', en: 'Feather wand', tr: 'Tüylü olta', cost: 110, joy: 34, art: 'wand', enDesc: 'Turns any cat into a lunatic.', trDesc: 'Her kediyi delirtir.' },
  { id: 'puzzle', en: 'Puzzle box', tr: 'Bulmaca kutusu', cost: 165, joy: 42, art: 'puzzle', enDesc: 'Twenty minutes of quiet.', trDesc: 'Yirmi dakikalık sessizlik.' }
];
const BOOSTERS = [
  { id: 'moves', en: '+5 moves', tr: '+5 hamle', cost: 90, icon: 'plusmove', enDesc: 'Five extra moves before the level starts.', trDesc: 'Bölüm başlamadan beş hamle ekler.' },
  { id: 'hammer', en: 'Hammer', tr: 'Çekiç', cost: 70, icon: 'hammer', enDesc: 'Smash any single tile or blocker.', trDesc: 'Tek bir taşı ya da engeli kırar.' },
  { id: 'swap', en: 'Free swap', tr: 'Serbest takas', cost: 80, icon: 'swap', enDesc: 'Swap any two tiles, anywhere, for free.', trDesc: 'İstediğin iki taşı bedavaya değiştirir.' },
  { id: 'shuffle', en: 'Shuffle', tr: 'Karıştır', cost: 60, icon: 'shuffle', enDesc: 'Reshuffle the board without spending a move.', trDesc: 'Hamle harcamadan tahtayı karıştırır.' }
];
const HATS = [
  { id: 'none', en: 'No hat', tr: 'Yok', cost: 0, art: 'none' },
  { id: 'party', en: 'Party hat', tr: 'Parti şapkası', cost: 60, art: 'party' },
  { id: 'beanie', en: 'Wool beanie', tr: 'Yün bere', cost: 90, art: 'beanie' },
  { id: 'flower', en: 'Daisy', tr: 'Papatya', cost: 75, art: 'flower' },
  { id: 'crown', en: 'Tin crown', tr: 'Teneke taç', cost: 240, art: 'crown' },
  { id: 'chef', en: 'Chef hat', tr: 'Aşçı külahı', cost: 180, art: 'chef' }
];
const COLLARS = [
  { id: 'none', en: 'Bare neck', tr: 'Yok', cost: 0, hex: null },
  { id: 'red', en: 'Red collar', tr: 'Kırmızı tasma', cost: 40, hex: '#D2536A' },
  { id: 'teal', en: 'Teal collar', tr: 'Camgöbeği tasma', cost: 40, hex: '#3E9E9E' },
  { id: 'gold', en: 'Gold collar', tr: 'Altın tasma', cost: 130, hex: '#E0A73C' },
  { id: 'plum', en: 'Plum collar', tr: 'Mor tasma', cost: 40, hex: '#7E62A8' },
  { id: 'bandana', en: 'Bandana', tr: 'Bandana', cost: 95, hex: '#E07A4B', bandana: true }
];
const FURNITURE = [
  { id: 'rug', en: 'Round rug', tr: 'Yuvarlak halı', cost: 80, slot: 'floor', enDesc: 'Warm spot by the window.', trDesc: 'Pencere önünde sıcak bir yer.' },
  { id: 'plant', en: 'Fern', tr: 'Eğrelti otu', cost: 65, slot: 'left', enDesc: 'Will be chewed within a week.', trDesc: 'Bir hafta içinde kemirilecek.' },
  { id: 'shelf', en: 'Shelf', tr: 'Raf', cost: 120, slot: 'wall', enDesc: 'Holds three things and a cat.', trDesc: 'Üç eşya ve bir kedi taşır.' },
  { id: 'lamp', en: 'Floor lamp', tr: 'Lambader', cost: 140, slot: 'right', enDesc: 'Turns the room to evening.', trDesc: 'Odayı akşama çevirir.' },
  { id: 'tower', en: 'Cat tower', tr: 'Kedi kulesi', cost: 260, slot: 'right', enDesc: 'The high ground.', trDesc: 'Yüksek mevzi.' },
  { id: 'window', en: 'Bird feeder', tr: 'Kuş yemliği', cost: 190, slot: 'wall', enDesc: 'Television for pets.', trDesc: 'Hayvanlar için televizyon.' },
  { id: 'basket', en: 'Toy basket', tr: 'Oyuncak sepeti', cost: 100, slot: 'left', enDesc: 'Everything ends up on the floor anyway.', trDesc: 'Nasılsa hepsi yere dökülüyor.' },
  { id: 'poster', en: 'Framed print', tr: 'Çerçeveli baskı', cost: 110, slot: 'wall', enDesc: 'A very good dog, painted badly.', trDesc: 'Çok iyi bir köpek, kötü çizilmiş.' }
];
const ROOM_THEMES = [
  { id: 'oat', en: 'Oat', tr: 'Yulaf', cost: 0, wall: '#E4D3B8', wall2: '#D3BE9E', floor: '#C79A6A' },
  { id: 'sage', en: 'Sage', tr: 'Adaçayı', cost: 150, wall: '#BFD3C1', wall2: '#A5BCA8', floor: '#B08A62' },
  { id: 'blush', en: 'Blush', tr: 'Pudra', cost: 150, wall: '#EBC9C6', wall2: '#D6ACA9', floor: '#C09070' },
  { id: 'night', en: 'Deep blue', tr: 'Gece mavisi', cost: 220, wall: '#3D4C66', wall2: '#2E3A50', floor: '#6A5240' }
];

/* How many baskets ride the board at once on a rescue level. A pup only
   drops a row when something below it in its column clears — about one
   row per move — so with three in play a five-pup goal cost fifty moves.
   Five in flight keeps the goal honest without changing the mechanic. */
const PUPS_IN_PLAY = 5;

/* ---------- traits ----------
   A pet's trait is not rolled at adoption, it is earned: whichever way
   you look after them most becomes who they are, and it pays back into
   the board. Settled once they reach bond level 3. */
const TRAITS = {
  greedy: {
    en: 'Greedy', tr: 'Obur',
    enDesc: 'Fed more than anything else. Finds an extra coin in everything.',
    trDesc: 'En çok yemek yedi. Her işten fazladan altın çıkarıyor.',
    enHow: 'Fed the most', trHow: 'En çok yedirildi'
  },
  playful: {
    en: 'Playful', tr: 'Oyuncu',
    enDesc: 'Played with constantly. Their move charges faster.',
    trDesc: 'Sürekli oynandı. Hamlesi daha hızlı doluyor.',
    enHow: 'Played with the most', trHow: 'En çok oynandı'
  },
  tidy: {
    en: 'Tidy', tr: 'Titiz',
    enDesc: 'Washed more than any cat would like. Worth an extra move.',
    trDesc: 'Hiçbir kedinin istemeyeceği kadar yıkandı. Bir hamle değerinde.',
    enHow: 'Washed the most', trHow: 'En çok yıkandı'
  },
  dozy: {
    en: 'Dozy', tr: 'Uykucu',
    enDesc: 'Slept through most of it. Everything fades more slowly.',
    trDesc: 'Çoğunu uyuyarak geçirdi. Her şey daha yavaş azalıyor.',
    enHow: 'Slept the most', trHow: 'En çok uyudu'
  }
};
const TRAIT_AT_BOND = 3;

/* ---------- the shelf ----------
   Each one reads straight off the save, so nothing has to be recorded
   twice. `at` returns the current figure, `of` the figure that earns it. */
const BADGES = [
  {
    id: 'first', icon: 'paw', fam: 'lane', en: 'First one home', tr: 'İlk geçiş',
    enDesc: 'Clear a level.', trDesc: 'Bir bölüm geç.',
    of: 1, at: s => s.stats.cleared, coins: 40
  },
  {
    id: 'ten', icon: 'play', fam: 'lane', en: 'Getting the hang of it', tr: 'Eli alıştı',
    enDesc: 'Clear ten levels.', trDesc: 'On bölüm geç.',
    of: 10, at: s => s.stats.cleared, coins: 120
  },
  {
    id: 'thirty', icon: 'home', fam: 'lane', en: 'Lane regular', tr: 'Sokağın müdavimi',
    enDesc: 'Clear thirty levels.', trDesc: 'Otuz bölüm geç.',
    of: 30, at: s => s.stats.cleared, coins: 300, treats: 2
  },
  {
    id: 'star3', icon: 'star', fam: 'star', en: 'Perfectionist', tr: 'Mükemmeliyetçi',
    enDesc: 'Take three stars from a level.', trDesc: 'Bir bölümden üç yıldız al.',
    of: 1, at: s => Object.values(s.stars).filter(v => v >= 3).length, coins: 60
  },
  {
    id: 'star3x10', icon: 'sparkle', fam: 'star', en: 'Ten perfect runs', tr: 'On kusursuz geçiş',
    enDesc: 'Three-star ten levels.', trDesc: 'On bölümü üç yıldızla geç.',
    of: 10, at: s => Object.values(s.stars).filter(v => v >= 3).length, coins: 250, treats: 2
  },
  {
    id: 'combo5', icon: 'flame', fam: 'feat', en: 'Snowball', tr: 'Çığ',
    enDesc: 'Set off a five-chain cascade.', trDesc: 'Beş zincirlik bir çığ başlat.',
    of: 5, at: s => s.stats.bestCombo, coins: 80
  },
  {
    id: 'combo8', icon: 'bolt', fam: 'feat', en: 'Avalanche', tr: 'Heyelan',
    enDesc: 'Set off an eight-chain cascade.', trDesc: 'Sekiz zincirlik bir çığ başlat.',
    of: 8, at: s => s.stats.bestCombo, coins: 220, treats: 1
  },
  {
    id: 'big30', icon: 'hammer', fam: 'feat', en: 'One good move', tr: 'Tek iyi hamle',
    enDesc: 'Clear thirty tiles in a single move.', trDesc: 'Tek hamlede otuz taş temizle.',
    of: 30, at: s => s.stats.biggestClear, coins: 150
  },
  {
    id: 'pop2k', icon: 'shuffle', fam: 'feat', en: 'Two thousand faces', tr: 'İki bin yüz',
    enDesc: 'Clear two thousand tiles in total.', trDesc: 'Toplam iki bin taş temizle.',
    of: 2000, at: s => s.stats.tilesPopped, coins: 200
  },
  {
    id: 'rescue10', icon: 'heart', fam: 'lane', en: 'Ten walked home', tr: 'On tanesi evde',
    enDesc: 'Walk ten baskets to the door.', trDesc: 'On sepeti kapıya götür.',
    of: 10, at: s => s.stats.rescued, coins: 180, treats: 1
  },
  {
    id: 'family2', icon: 'paw', fam: 'family', en: 'Company', tr: 'Arkadaş',
    enDesc: 'Adopt a second pet.', trDesc: 'İkinci bir hayvan sahiplen.',
    of: 2, at: s => s.pets.length, coins: 100
  },
  {
    id: 'family4', icon: 'home', fam: 'family', en: 'A full house', tr: 'Ev doldu',
    enDesc: 'Have four pets at home.', trDesc: 'Evde dört hayvan olsun.',
    of: 4, at: s => s.pets.length, coins: 300, treats: 2
  },
  {
    id: 'family6', icon: 'crown', fam: 'family', en: 'Everybody', tr: 'Herkes burada',
    enDesc: 'Adopt every breed on the lane.', trDesc: 'Sokaktaki her cinsi sahiplen.',
    of: 6, at: s => s.pets.length, coins: 600, treats: 5
  },
  {
    id: 'bond5', icon: 'heart', fam: 'family', en: 'Inseparable', tr: 'Ayrılmaz',
    enDesc: 'Reach bond level five with any pet.', trDesc: 'Bir hayvanla beşinci bağ seviyesine ulaş.',
    of: 5, at: s => s.pets.reduce((m, p) => Math.max(m, p.bond), 0), coins: 160
  },
  {
    id: 'bond12', icon: 'star', fam: 'family', en: 'Grown up together', tr: 'Birlikte büyüdük',
    enDesc: 'Reach bond level twelve.', trDesc: 'On ikinci bağ seviyesine ulaş.',
    of: 12, at: s => s.pets.reduce((m, p) => Math.max(m, p.bond), 0), coins: 400, treats: 3
  },
  {
    id: 'care100', icon: 'bowl', fam: 'care', en: 'Devoted', tr: 'Kendini adamış',
    enDesc: 'Look after your pets a hundred times.', trDesc: 'Hayvanlarınla yüz kez ilgilen.',
    of: 100, at: s => s.stats.cared, coins: 250, treats: 1
  },
  {
    id: 'streak7', icon: 'flame', fam: 'care', en: 'A week of it', tr: 'Bir hafta boyunca',
    enDesc: 'Come back seven days running.', trDesc: 'Yedi gün üst üste gel.',
    of: 7, at: s => s.streak, coins: 220, treats: 3
  },
  {
    id: 'walk7', icon: 'ball', fam: 'care', en: 'Seven walks', tr: 'Yedi yürüyüş',
    enDesc: 'Finish the daily walk seven days running.', trDesc: 'Günlük yürüyüşü yedi gün üst üste bitir.',
    of: 7, at: s => (s.daily && s.daily.streak) || 0, coins: 300, treats: 3
  },
  {
    id: 'decor', icon: 'brush', fam: 'care', en: 'Interior decorator', tr: 'İç mimar',
    enDesc: 'Own five things for the room.', trDesc: 'Oda için beş eşyan olsun.',
    of: 5, at: s => Object.keys(s.furniture || {}).length, coins: 180
  }
];
function badgeName(b) { return LANG === 'tr' ? b.tr : b.en; }
function badgeDesc(b) { return LANG === 'tr' ? b.trDesc : b.enDesc; }
function traitName(id) { const t = TRAITS[id]; return t ? (LANG === 'tr' ? t.tr : t.en) : ''; }
function traitDesc(id) { const t = TRAITS[id]; return t ? (LANG === 'tr' ? t.trDesc : t.enDesc) : ''; }
function traitHow(id) { const t = TRAITS[id]; return t ? (LANG === 'tr' ? t.trHow : t.enHow) : ''; }

/* ---------- the pet's favourite tile ---------- */
/* The one thing joining the two halves of this game is that matching
   your own pet's breed charges its move. There are six breeds, and a
   level may deal five colours: twelve of the sixty handcrafted levels
   do, along with every generated level in the first two tiers and half
   the daily walks. A pug on one of those was charging at the slow rate
   for the whole level while being told to match a tile that was not
   there. Measured by `test/charge.js` over those twelve levels, the
   meter filled 3.19 times for every other breed and 1.06 times for the
   pug — a third of the pet moves, on a third of the early lane, decided
   by which animal you liked the look of in onboarding.

   Worse than the rate: `primaryGoalType` handed the same number to the
   abilities, so on a level with no collect goal a retriever's Fetch
   found no tiles and did nothing at all, and a pug's Snuffle painted
   tiles a colour the board can never deal again.

   So the favourite is the breed while the breed is dealt, and the tile
   beside it when it is not. Every reader goes through here, and the
   interface says which tile it landed on rather than assuming. */
/* The breed standing in a board slot, and its colours. A slot's look
   follows whoever is in it rather than the slot number: the cast is a
   permutation of the same six breeds, so all six gem colours and all six
   silhouettes are still on the board and still unique — a Pug is a pink
   clover on every board there has ever been, it is just that whether
   there is a Pug on your board at all depends on who you have taken in. */
function slotBreed(slot) {
  return (typeof castBreed === 'function') ? castBreed(slot)
    : Math.max(0, Math.round(+slot || 0)) % BREEDS.length;
}
function slotGem(slot) {
  const b = BREEDS[slotBreed(slot)];
  return b ? b.gem : '#888888';
}
function favTypeFor(breed, types) {
  const b = Math.max(0, Math.round(+breed || 0));
  if (!(types > 0)) return b;
  return b < types ? b : b % types;
}
/* what a tile is worth to the meter: its own breed, and anything else */
const CHARGE_FAV = 4.2, CHARGE_OTHER = .55;

/* ---------- goal kinds ---------- */
const GK = { SCORE: 'score', COLLECT: 'collect', CRATE: 'crate', MUD: 'mud', RESCUE: 'rescue', BRAMBLE: 'bramble' };
/* how many cells a bramble patch may ever cover, as a share of the
   open board — without this a bad run could strangle the level */
const BRAMBLE_CAP = 0.42;
/* a bramble takes one more cell every this many moves — the single dial
   that decides whether the patch is a chore or a race */
const BRAMBLE_EVERY = 2;

/* Level maps: '.' open · '#' hole · 'c'/'C' crate 1-2hp
   'm'/'M' mud 1-2hp · 'i' iced tile                       */
/* Numbers here are measured, not guessed: test/tune.js plays each level
   with a solver and reports how many moves a strong player needs. Goals
   and budgets are set so that lands near 72% of the budget — room to
   recover from a bad board, and no level that ends on move three.

   Yield per move, from those runs: a 5-colour board clears ~11 tiles a
   move, a 6-colour board ~8.7. A targeted colour arrives ~1.9/move at 5
   colours, ~1.4 at 6. Crates break ~0.8/move, mud clears ~1.3/move, and
   a basket needs ~11 moves to reach the floor — which is why rescue
   counts are small and their budgets generous. */
/* Numbers here are measured, not guessed. test/tune.js plays each level
   with a solver and reports the moves a strong player needs; test/ai.js
   then reports clear rates. Goals and budgets are set so a good player
   needs roughly 72% of the budget.

   Yield per move, from those runs: a 5-colour board clears ~11 tiles a
   move, a 6-colour board ~8.7; a targeted colour arrives ~1.9/move at 5
   colours and ~1.4 at 6; crates break ~2/move when clustered, mud clears
   ~1.3/move, and a basket needs several moves to reach the floor.

   One hard rule: a rescue level must never block a column. Holes, ice and
   full-width crate rows all stop a basket falling, and levels that mixed
   them with a rescue goal measured at 0-20% clear. Mud is the safe
   obstacle there — it sits under the tile and never blocks the drop. */
const LEVELS = [
  /* The opening is not a difficulty band, it is an introduction. A
     level measured at 75-83% is an ordinary level of this lane and a
     coin flip for somebody who has never swapped a tile, has no
     boosters, no perks and no stage moves, and has just been asked to
     name an animal. The first three carry a real cushion; the curve
     descends from level 4, where it already did. */
  { n: 1, w: 7, h: 7, types: 5, moves: 22, goals: [[GK.COLLECT, 0, 34]], base: 10500, tut: 'swap' },
  { n: 2, w: 7, h: 7, types: 5, moves: 24, goals: [[GK.COLLECT, 3, 33], [GK.COLLECT, 1, 28]], base: 10400 },
  { n: 3, w: 7, h: 8, types: 5, moves: 24, goals: [[GK.SCORE, 0, 14500]], base: 22500, tut: 'special' },
  {
    n: 4, w: 7, h: 8, types: 5, moves: 18, goals: [[GK.MUD, 0, 76]], base: 11000,
    map: ['.......', 'MMMMMMM', 'MMMMMMM', 'MMMMMMM', 'MMMMMMM', 'MMMMMMM', 'MMMMMMM', '.......']
  },
  { n: 5, w: 8, h: 8, types: 5, moves: 24, goals: [[GK.COLLECT, 2, 50], [GK.COLLECT, 4, 40]], base: 17000 },
  {
    n: 6, w: 8, h: 8, types: 5, moves: 16, goals: [[GK.CRATE, 0, 28]], base: 8000,
    map: ['..cccc..', '.cc..cc.', 'cc....cc', 'c......c', 'c......c', 'cc....cc', '.cc..cc.', '..cccc..']
  },
  { n: 7, w: 8, h: 8, types: 5, moves: 24, goals: [[GK.RESCUE, 0, 2]], base: 12500, tut: 'rescue' },
  {
    n: 8, w: 8, h: 8, types: 5, moves: 26, goals: [[GK.COLLECT, 4, 60], [GK.MUD, 0, 16]], base: 16800,
    map: ['........', '.mmmmmm.', '.m....m.', '.m....m.', '.m....m.', '.m....m.', '.mmmmmm.', '........']
  },
  {
    n: 9, w: 8, h: 8, types: 5, moves: 24, goals: [[GK.SCORE, 0, 19000]], base: 21000,
    map: ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##']
  },
  { n: 10, w: 8, h: 9, types: 5, moves: 26, goals: [[GK.COLLECT, 1, 82], [GK.COLLECT, 3, 64]], base: 26000 },
  {
    n: 11, w: 8, h: 9, types: 6, moves: 24, goals: [[GK.CRATE, 0, 28]], base: 9200,
    map: ['..cccc..', '.cc..cc.', 'cc....cc', 'c......c', '........', 'c......c', 'cc....cc', '.cc..cc.', '..cccc..']
  },
  { n: 12, w: 8, h: 9, types: 5, moves: 28, goals: [[GK.RESCUE, 0, 2], [GK.COLLECT, 0, 44]], base: 15500 },
  {
    n: 13, w: 8, h: 8, types: 6, moves: 26, goals: [[GK.MUD, 0, 24]], base: 8000,
    map: ['MMMM....', 'MMMM....', '........', '........', '........', '........', '....MMMM', '....MMMM']
  },
  {
    n: 14, w: 8, h: 9, types: 6, moves: 28, goals: [[GK.BRAMBLE, 0, 18]], base: 14000, tut: 'bramble',
    map: ['........', '........', '.vvvvvv.', '.vvvvvv.', '.vvvvvv.', '........', '........', '........', '........']
  },
  {
    n: 15, w: 8, h: 9, types: 5, moves: 26, goals: [[GK.COLLECT, 4, 60], [GK.CRATE, 0, 16]], base: 21000,
    map: ['..c..c..', '.cc..cc.', '........', '.c....c.', '........', '.c....c.', '........', '.cc..cc.', '..c..c..']
  },
  {
    n: 16, w: 8, h: 9, types: 6, moves: 32, goals: [[GK.RESCUE, 0, 2], [GK.MUD, 0, 16]], base: 12000,
    map: ['........', '...mm...', '..mmmm..', '.mmmmmm.', 'mmmmmmmm', '.mmmmmm.', '..mmmm..', '...mm...', '........']
  },
  {
    n: 17, w: 8, h: 9, types: 6, moves: 28, goals: [[GK.MUD, 0, 22], [GK.COLLECT, 2, 32]], base: 12700,
    map: ['........', '.mmmmmm.', '.m....m.', '.m....m.', '.m....m.', '.m....m.', '.m....m.', '.mmmmmm.', '........']
  },
  {
    n: 18, w: 8, h: 9, types: 6, moves: 26, goals: [[GK.CRATE, 0, 16]], base: 11800,
    map: ['C......C', '........', '..cccc..', '..c..c..', '..c..c..', '..cccc..', '........', 'C......C', '........']
  },
  { n: 19, w: 8, h: 9, types: 6, moves: 28, goals: [[GK.COLLECT, 0, 40], [GK.COLLECT, 2, 34], [GK.COLLECT, 5, 29]], base: 14500 },
  { n: 20, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.RESCUE, 0, 2], [GK.SCORE, 0, 9500]], base: 13500 },
  {
    n: 21, w: 8, h: 9, types: 6, moves: 26, goals: [[GK.MUD, 0, 24]], base: 9500,
    map: ['........', '........', 'mmmmmmmm', '........', 'mmmmmmmm', '........', 'mmmmmmmm', '........', '........']
  },
  {
    n: 22, w: 8, h: 9, types: 6, moves: 28, goals: [[GK.CRATE, 0, 12], [GK.COLLECT, 3, 34]], base: 12500,
    map: ['..CCCC..', '........', '.c....c.', '..c..c..', '..c..c..', '........', '.c....c.', '........', '........']
  },
  {
    n: 23, w: 8, h: 9, types: 6, moves: 32, goals: [[GK.RESCUE, 0, 2], [GK.MUD, 0, 8]], base: 12300,
    map: ['........', '.m....m.', '..m..m..', '...mm...', '........', '...mm...', '..m..m..', '.m....m.', '........']
  },
  {
    n: 24, w: 8, h: 9, types: 6, moves: 32, goals: [[GK.BRAMBLE, 0, 28]], base: 14500,
    map: ['........', '.vv..vv.', '.vvvvvv.', '.vv..vv.', '........', '.vv..vv.', '.vvvvvv.', '.vv..vv.', '........']
  },
  {
    n: 25, w: 8, h: 9, types: 6, moves: 28, goals: [[GK.MUD, 0, 26], [GK.CRATE, 0, 8]], base: 11000,
    map: ['mmmmmmmm', 'm.c..c.m', 'm......m', 'm..cc..m', 'm..cc..m', 'm......m', 'm.c..c.m', 'mmmmmmmm', '........']
  },
  { n: 26, w: 8, h: 9, types: 6, moves: 34, goals: [[GK.COLLECT, 1, 20], [GK.RESCUE, 0, 2]], base: 12800 },
  {
    n: 27, w: 8, h: 9, types: 6, moves: 26, goals: [[GK.CRATE, 0, 22]], base: 10200,
    map: ['CC....CC', 'C......C', '..cccc..', '..c..c..', '..c..c..', '..cccc..', 'C......C', 'CC....CC', '........']
  },
  {
    n: 28, w: 8, h: 9, types: 6, moves: 34, goals: [[GK.MUD, 0, 32], [GK.COLLECT, 4, 24]], base: 14000,
    map: ['MMMMMMMM', 'MMMMMMMM', '........', '........', '........', '........', '........', '........', '........']
  },
  { n: 29, w: 8, h: 9, types: 6, moves: 34, goals: [[GK.RESCUE, 0, 2], [GK.COLLECT, 5, 18]], base: 13000 },
  {
    n: 30, w: 8, h: 9, types: 6, moves: 34, goals: [[GK.BRAMBLE, 0, 20], [GK.SCORE, 0, 10000]], base: 14800,
    map: ['........', '........', '.vvvvvv.', '.v....v.', '.v....v.', '.v....v.', '.vvvvvv.', '........', '........']
  },
  {
    n: 31, w: 8, h: 9, types: 6, moves: 22, goals: [[GK.CRATE, 0, 10], [GK.MUD, 0, 20]], base: 9600,
    map: ['mccccccm', 'm......m', 'm.mmmm.m', 'm......m', '........', 'm......m', 'm.mmmm.m', 'm......m', 'mccccccm']
  },
  {
    n: 32, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.RESCUE, 0, 2], [GK.CRATE, 0, 8]], base: 13000,
    map: ['........', '.c....c.', '........', '..c..c..', '........', '..c..c..', '........', '.c....c.', '........']
  },
  { n: 33, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.COLLECT, 0, 42], [GK.COLLECT, 3, 36], [GK.COLLECT, 5, 30]], base: 14500 },
  {
    n: 34, w: 8, h: 9, types: 6, moves: 28, goals: [[GK.MUD, 0, 60]], base: 13500,
    map: ['MMMMMMMM', 'M......M', 'M.mmmm.M', 'M.m..m.M', 'M.m..m.M', 'M.mmmm.M', 'M......M', 'MMMMMMMM', '........']
  },
  {
    n: 35, w: 8, h: 9, types: 6, moves: 32, goals: [[GK.CRATE, 0, 12], [GK.RESCUE, 0, 2]], base: 13500,
    map: ['........', '.cc..cc.', '........', '..c..c..', '........', '..c..c..', '........', '.cc..cc.', '........']
  },
  { n: 36, w: 8, h: 9, types: 6, moves: 28, goals: [[GK.SCORE, 0, 16000]], base: 19000 },
  {
    n: 37, w: 8, h: 9, types: 6, moves: 32, goals: [[GK.RESCUE, 0, 2], [GK.MUD, 0, 20]], base: 12000,
    map: ['mmmmmmmm', '........', '..mmmm..', '........', '........', '........', '..mmmm..', '........', 'mmmmmmmm']
  },
  {
    n: 38, w: 8, h: 9, types: 6, moves: 36, goals: [[GK.CRATE, 0, 12], [GK.COLLECT, 2, 28]], base: 10500,
    map: ['C.C..C.C', '........', 'iCiiiiCi', '........', '..CCCC..', '........', 'iCiiiiCi', '........', 'C.C..C.C']
  },
  {
    n: 39, w: 8, h: 9, types: 6, moves: 38, goals: [[GK.MUD, 0, 34], [GK.CRATE, 0, 8], [GK.RESCUE, 0, 2]], base: 14500,
    map: ['MMMMMMMM', 'Mc.cc.cM', 'M......M', 'M......M', 'M......M', 'M......M', 'M......M', 'Mc.cc.cM', 'MMMMMMMM']
  },
  { n: 40, w: 8, h: 9, types: 6, moves: 36, goals: [[GK.SCORE, 0, 10500], [GK.RESCUE, 0, 2]], base: 15500 },

  /* ---- the lane keeps going: 41 to 60 ---- */
  { n: 41, w: 8, h: 9, types: 6, moves: 25, goals: [[GK.COLLECT, 0, 34], [GK.COLLECT, 3, 28]], base: 12400 },
  {
    n: 42, w: 8, h: 9, types: 6, moves: 25, goals: [[GK.BRAMBLE, 0, 20], [GK.COLLECT, 1, 26]], base: 13200,
    map: ['........', '........', '..vvvv..', '.vvvvvv.', '.vvvvvv.', '..vvvv..', '........', '........', '........']
  },
  {
    n: 43, w: 8, h: 9, types: 6, moves: 20, goals: [[GK.CRATE, 0, 28]], base: 8000,
    map: ['c......c', '.cccccc.', '.c....c.', '.c.cc.c.', '.c.cc.c.', '.c....c.', '.cccccc.', 'c......c', '........']
  },
  {
    n: 44, w: 8, h: 9, types: 6, moves: 32, goals: [[GK.MUD, 0, 14], [GK.RESCUE, 0, 2]], base: 12000,
    map: ['........', '........', '..mmmm..', '.mmmmmm.', '.mmmmmm.', '..mmmm..', '........', '........', '........']
  },
  {
    n: 45, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.SCORE, 0, 11200]], base: 13000,
    map: ['##....##', '#......#', '........', '...##...', '...##...', '........', '#......#', '##....##', '........']
  },
  {
    n: 46, w: 8, h: 9, types: 6, moves: 22, goals: [[GK.BRAMBLE, 0, 14]], base: 8600,
    map: ['........', '..vvvv..', '..v..v..', '..v..v..', '..v..v..', '..vvvv..', '........', '........', '........']
  },
  {
    n: 47, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.COLLECT, 2, 34], [GK.COLLECT, 5, 28]], base: 13000,
    map: ['........', '..iiii..', '........', '.i....i.', '.i....i.', '........', '..iiii..', '........', '........']
  },
  {
    n: 48, w: 8, h: 9, types: 6, moves: 27, goals: [[GK.BRAMBLE, 0, 16], [GK.CRATE, 0, 8]], base: 12200,
    map: ['cc....cc', '........', '..vvvv..', '..vvvv..', '..vvvv..', '..vvvv..', '........', 'cc....cc', '........']
  },
  { n: 49, w: 8, h: 9, types: 6, moves: 34, goals: [[GK.RESCUE, 0, 3], [GK.SCORE, 0, 11000]], base: 13000 },
  {
    n: 50, w: 8, h: 9, types: 6, moves: 29, goals: [[GK.MUD, 0, 40], [GK.CRATE, 0, 8], [GK.COLLECT, 0, 26]], base: 13000,
    map: ['MMMMMMMM', 'M.cccc.M', 'M......M', 'M......M', 'M......M', 'M......M', 'M.cccc.M', 'MMMMMMMM', '........']
  },
  { n: 51, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.COLLECT, 1, 32], [GK.COLLECT, 3, 28], [GK.COLLECT, 5, 24]], base: 14000 },
  {
    n: 52, w: 8, h: 9, types: 6, moves: 36, goals: [[GK.BRAMBLE, 0, 24]], base: 16000,
    map: ['.vvvvvv.', '.vvvvvv.', '........', '........', '........', '........', '.vvvvvv.', '.vvvvvv.', '........']
  },
  {
    n: 53, w: 8, h: 9, types: 6, moves: 32, goals: [[GK.CRATE, 0, 12], [GK.COLLECT, 4, 28]], base: 14500,
    map: ['iCiiiiCi', '........', '..CCCC..', '........', '........', '........', '..CCCC..', '........', 'iCiiiiCi']
  },
  { n: 54, w: 8, h: 9, types: 6, moves: 38, goals: [[GK.RESCUE, 0, 3]], base: 16500 },
  { n: 55, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.SCORE, 0, 16400]], base: 19800 },
  {
    n: 56, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.MUD, 0, 38]], base: 10900,
    map: ['mmmmmmmm', 'mmmmmmmm', 'mmmmmmmm', '........', '........', '........', 'mmmmmmmm', 'mmmmmmmm', '........']
  },
  {
    n: 57, w: 8, h: 9, types: 6, moves: 34, goals: [[GK.BRAMBLE, 0, 20], [GK.MUD, 0, 16]], base: 16500,
    map: ['mmmmmmmm', '........', '..vvvv..', '.vvvvvv.', '.vvvvvv.', '..vvvv..', '........', 'mmmmmmmm', '........']
  },
  {
    n: 58, w: 8, h: 9, types: 6, moves: 24, goals: [[GK.CRATE, 0, 30]], base: 8500,
    map: ['CCCCCCCC', 'C......C', 'C.cccc.C', 'C.c..c.C', 'C.c..c.C', 'C.cccc.C', 'C......C', 'CCCCCCCC', '........']
  },
  { n: 59, w: 8, h: 9, types: 6, moves: 36, goals: [[GK.RESCUE, 0, 2], [GK.COLLECT, 0, 24], [GK.COLLECT, 4, 20]], base: 15500 },
  {
    n: 60, w: 8, h: 9, types: 6, moves: 30, goals: [[GK.BRAMBLE, 0, 16], [GK.CRATE, 0, 8], [GK.COLLECT, 2, 38]], base: 17000,
    map: ['mmmmmmmm', '.cc..cc.', '..vvvv..', '..vvvv..', '..vvvv..', '..vvvv..', '.cc..cc.', 'mmmmmmmm', '........']
  }
];

/* Beyond the handcrafted run, keep going forever. */
/* How much mud and how many crates a map actually contains.
   'M' is two layers of mud; 'C' is a two-hit crate but still one crate. */
function mapStock(def) {
  let mud = 0, crate = 0, bram = 0;
  (def.map || []).forEach(row => {
    for (const ch of row) {
      if (ch === 'm') mud += 1;
      else if (ch === 'M') mud += 2;
      else if (ch === 'c' || ch === 'C') crate += 1;
      else if (ch === 'v') bram += 1;
    }
  });
  return { mud, crate, bram };
}

/* A mud or crate goal can only ask for what the board holds. Asking for
   more makes the level literally uncompletable, so every definition is
   clamped to its own map on the way out — including generated ones. */
function normaliseGoals(def) {
  if (def._fixed) return def;
  const stock = mapStock(def);
  const goals = [];
  def.goals.forEach(g => {
    const [kind, arg, count] = g;
    if (kind === GK.BRAMBLE) {
      /* A bramble only spreads from another bramble, so once the patch is
         fully cut there is nothing left to grow — asking for more cuts
         than the patch holds can strand the level one short. The goal is
         "clear the patch"; the regrowth is what makes that hard. */
      if (stock.bram <= 0) return;
      goals.push([kind, arg, Math.min(count, stock.bram)]);
      return;
    }
    if (kind === GK.MUD || kind === GK.CRATE) {
      const have = kind === GK.MUD ? stock.mud : stock.crate;
      if (have <= 0) return;                       // nothing to clean: drop it
      goals.push([kind, arg, Math.min(count, have)]);
    } else goals.push(g);
  });
  if (!goals.length) goals.push([GK.SCORE, 0, def.base]);
  def.goals = goals;
  def._fixed = true;
  return def;
}

/* Densities tuned so a generated goal is worth setting: the clamp to
   map contents means a thin scattering becomes a two-move level. */
/* Each kind resolves at its own speed — crates go down about twice as
   fast as anything else — so the move budget belongs to the kind, not to
   the level number. Measured with test/ai.js over the 41-58 run. */
/* Each kind resolves at its own speed — crates go down about twice as
   fast as anything else — so the move budget belongs to the kind, not to
   the level number. These sit a little easier than the handcrafted run:
   the endless tail is somewhere to keep playing, not a difficulty wall.
   Measured with test/ai.js over the 41-70 run. */
const GEN = {
  mud:     { fill: .58, deep: .70, base: 8200,  moves: 22 },
  crate:   { fill: .46, deep: .38, base: 6400,  moves: 24 },
  bramble: { goal: n => 12 + n * 2, base: 11500, moves: 30 },
  collect: { base: 10500, moves: 30 },
  rescue:  { base: 10000, moves: 32 },
  score:   { base: 13400, moves: 30 }
};

/* Tiles a move is worth, measured by playing: a solver on a five-colour
   board clears about eleven a move, on six about nine. Everything the
   generator asks for is worked back from these instead of guessed, and
   every one of them stops climbing at the top tier — a goal that grows
   without a ceiling is a level that eventually cannot be won. */
/* Targeted tiles a move turns up while you are chasing two colours,
   measured with the solver. The fifth colour is worth far more than its
   share of the board suggests, because a board with one colour fewer
   cascades much further, so these are two measurements rather than one
   formula: 26 moves on five colours delivers the 146 that level 10 asks
   for; 30 moves on six delivers about 60. */
const COLLECT_RATE = { 5: 5.4, 6: 2.0 };
function collectPair(moves, types, tier) {
  const rate = COLLECT_RATE[types] || COLLECT_RATE[6];
  const total = Math.round(moves * rate * (.90 + tier * .05));
  return [Math.round(total * .55), Math.round(total * .45)];
}

/* ---------- shapes for the generated levels ----------

   A generated map used to be a coin flip per cell, which is fair — the
   goals are worked out from whatever it produces — and shapeless. Sixty
   handcrafted levels have arrangements somebody chose, and then level 61
   is static. These are eight arrangements, picked by seed, so a
   generated board has a form you can read at a glance and plan against.

   Each returns the cells to fill. Coverage is kept between roughly a
   third and a half so the stock, and therefore the goal, stays sane. */
function shapeMask(name, w, h, r) {
  const on = new Set();
  const add = (y, x) => { if (y >= 0 && y < h && x >= 0 && x < w) on.add(y + ':' + x); };
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  if (name === 'bands') {
    const top = 1 + Math.floor(r() * 2);
    for (let y = top; y < h - 1; y += 3) for (let x = 0; x < w; x++) { add(y, x); add(y + 1, x); }
  } else if (name === 'columns') {
    const off = Math.floor(r() * 2);
    for (let x = off; x < w; x += 3) for (let y = 1; y < h - 1; y++) { add(y, x); add(y, x + 1); }
  } else if (name === 'diamond') {
    const rad = Math.min(w, h) * .52;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (Math.abs(x - cx) + Math.abs(y - cy) * 1.05 <= rad) add(y, x);
  } else if (name === 'ring') {
    const m = 1 + Math.floor(r() * 2);
    for (let y = m; y < h - m; y++) for (let x = m; x < w - m; x++)
      if (y === m || y === h - m - 1 || x === m || x === w - m - 1) { add(y, x); }
    for (let x = m; x < w - m; x++) { add(m + 1, x); add(h - m - 2, x); }
  } else if (name === 'corners') {
    const bw = Math.max(2, Math.round(w * .38)), bh = Math.max(2, Math.round(h * .30));
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      add(y + 1, x); add(y + 1, w - 1 - x);
      add(h - 2 - y, x); add(h - 2 - y, w - 1 - x);
    }
  } else if (name === 'checker') {
    for (let y = 1; y < h - 1; y++) for (let x = 0; x < w; x++)
      if (((y >> 1) + (x >> 1)) % 2 === 0) add(y, x);
  } else if (name === 'wedge') {
    const flip = r() < .5;
    for (let y = 1; y < h - 1; y++) {
      const n = Math.round((y / (h - 1)) * w);
      for (let x = 0; x < n; x++) add(y, flip ? x : w - 1 - x);
    }
  } else {                                   /* blob */
    const bx = 2 + r() * (w - 4), by = 2.2 + r() * (h - 4.4);
    const rad = Math.min(w, h) * (.40 + r() * .10);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (Math.hypot(x - bx, (y - by) * .92) <= rad && r() < .93) add(y, x);
  }
  return on;
}
const SHAPES = ['bands', 'columns', 'diamond', 'ring', 'corners', 'checker', 'wedge', 'blob'];

function levelDef(n) {
  if (n === DAILY_LEVEL) return dailyLevel(SAVE ? SAVE.reached : 1);
  if (n <= LEVELS.length) return normaliseGoals(LEVELS[n - 1]);
  const r = mulberry(n * 7919);
  const kinds = [GK.COLLECT, GK.MUD, GK.CRATE, GK.RESCUE, GK.SCORE, GK.BRAMBLE];
  const kind = kinds[Math.floor(r() * kinds.length)];
  const tier = Math.min(4, Math.floor((n - 40) / 12));
  const h = 9, w = 8;
  /* the early tiers deal one colour fewer, which is how the handcrafted
     lane eases a player in — not by asking for less */
  const types = tier <= 1 ? 5 : 6;
  const key = kind === GK.BRAMBLE ? 'bramble' : kind;
  const moves = (GEN[key] && GEN[key].moves ? GEN[key].moves : 28) + (tier % 2);

  /* a bramble patch is a blob, not a sprinkle: scattered single cells
     read as noise and give the spread nothing to work with */
  const blob = new Set();
  if (kind === GK.BRAMBLE) {
    const cx = 2 + r() * (w - 4), cy = 2.5 + r() * (h - 5);
    const rad = 2.15 + r() * .3 + tier * .12;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= rad && r() < .88) blob.add(y + ':' + x);
      }
    }
  }

  /* mud and crates take an arrangement rather than a sprinkle */
  const shaped = (kind === GK.MUD || kind === GK.CRATE)
    ? shapeMask(SHAPES[Math.floor(r() * SHAPES.length)], w, h, r)
    : null;

  const map = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const v = r();
      if (kind === GK.BRAMBLE) {
        row += blob.has(y + ':' + x) ? 'v' : '.';
        continue;
      }
      if (kind === GK.MUD && shaped.has(y + ':' + x)) { row += r() < GEN.mud.deep ? 'M' : 'm'; continue; }
      if (kind === GK.CRATE && shaped.has(y + ':' + x) && y > 0 && y < h - 1) {
        /* a goal counts crates, not hits, so a second layer is the only
           way to make one of them cost a move */
        row += r() < GEN.crate.deep ? 'C' : 'c';
        continue;
      }
      /* holes never appear on a rescue level: a basket cannot fall
         through one, and such levels measured at near-zero clear */
      /* a hole beside a crate can wall a column off entirely, so a
         crate level gets far fewer of them */
      const holeAt = kind === GK.CRATE ? .988 : .96;
      if (kind !== GK.RESCUE && v > holeAt && y > 1 && y < h - 2 && x > 0 && x < w - 1) { row += '#'; continue; }
      row += '.';
    }
    map.push(row);
  }

  /* A little frost, once the player has been shown what it is. Never on
     a rescue level — a basket cannot pass it — and never more than one
     to a column, so no column is ever walled off. */
  if (tier >= 2 && kind !== GK.RESCUE && r() < .42) {
    const want = 2 + Math.floor(r() * 4);
    const used = new Set();
    for (let t = 0, placed = 0; t < 40 && placed < want; t++) {
      const x = Math.floor(r() * w), y = 1 + Math.floor(r() * (h - 3));
      if (used.has(x)) continue;
      if (map[y][x] !== '.') continue;
      map[y] = map[y].slice(0, x) + 'i' + map[y].slice(x + 1);
      used.add(x);
      placed++;
    }
  }

  /* the goal is a share of what this particular map holds: the last few
     obstacles on a board cost many moves each, so asking for all of them
     turns the end of a level into a search */
  const stock = mapStock({ map });
  const share = (have, frac) => Math.max(4, Math.round(have * frac));

  const goals = [];
  let base;
  if (kind === GK.SCORE) {
    base = GEN.score.base + tier * 700;
    goals.push([GK.SCORE, 0, base]);
  } else if (kind === GK.COLLECT) {
    const a = Math.floor(r() * types);
    let b = Math.floor(r() * types);
    if (b === a) b = (b + 1) % types;          /* two different colours */
    const pair = collectPair(moves, types, tier);
    goals.push([GK.COLLECT, a, pair[0]]);
    goals.push([GK.COLLECT, b, pair[1]]);
    base = GEN.collect.base + tier * 500;
  } else if (kind === GK.MUD) {
    goals.push([GK.MUD, 0, share(stock.mud, .74 + tier * .05)]);
    base = GEN.mud.base + tier * 400;
  } else if (kind === GK.CRATE) {
    goals.push([GK.CRATE, 0, share(stock.crate, .68 + tier * .045)]);
    base = GEN.crate.base + tier * 400;
  } else if (kind === GK.RESCUE) {
    /* three baskets down a board nobody designed measured at 0% */
    goals.push([GK.RESCUE, 0, 2]);
    base = GEN.rescue.base + tier * 400;
  } else {
    goals.push([GK.BRAMBLE, 0, GEN.bramble.goal(tier)]);
    base = GEN.bramble.base + tier * 400;
  }

  return normaliseGoals({ n, w, h, types, moves, goals, base, map });
}
/* ---------- the daily walk ----------
   Seeded from the date so everyone on a given day gets the same board,
   and sized against how far the player has actually got rather than a
   fixed difficulty. Free to attempt: it is the reason to come back. */
function dayNumber(t) {
  const d = new Date(t === undefined ? Date.now() : t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
function dailyLevel(reached, dayNo) {
  const day = dayNo === undefined ? dayNumber() : dayNo;
  const r = mulberry(day * 2654435761 >>> 0);
  /* tier follows progress, so a new player is not handed a level 60 board */
  const tier = clamp(Math.floor((reached || 1) / 14), 0, 4);
  const kinds = [GK.COLLECT, GK.MUD, GK.CRATE, GK.RESCUE, GK.SCORE, GK.BRAMBLE];
  const kind = kinds[Math.floor(r() * kinds.length)];
  const h = 9, w = 8;
  const key = kind === GK.BRAMBLE ? 'bramble' : kind;
  const moves = (GEN[key] && GEN[key].moves ? GEN[key].moves : 28) + 2;
  const types = tier <= 1 ? 5 : 6;

  const blob = new Set();
  if (kind === GK.BRAMBLE) {
    const cx = 2 + r() * (w - 4), cy = 2.5 + r() * (h - 5);
    const rad = 2.1 + r() * .4 + tier * .2;   /* a longer lane means a wider patch */
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (Math.hypot(x - cx, y - cy) <= rad && r() < .9) blob.add(y + ':' + x);
    }
  }
  const shaped = (kind === GK.MUD || kind === GK.CRATE)
    ? shapeMask(SHAPES[Math.floor(r() * SHAPES.length)], w, h, r)
    : null;

  const map = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const v = r();
      if (kind === GK.BRAMBLE) { row += blob.has(y + ':' + x) ? 'v' : '.'; continue; }
      if (kind === GK.MUD && shaped.has(y + ':' + x)) { row += r() < GEN.mud.deep ? 'M' : 'm'; continue; }
      if (kind === GK.CRATE && shaped.has(y + ':' + x) && y > 0 && y < h - 1) {
        row += r() < GEN.crate.deep ? 'C' : 'c';
        continue;
      }
      const holeAt = kind === GK.CRATE ? .99 : .97;
      if (kind !== GK.RESCUE && v > holeAt && y > 1 && y < h - 2 && x > 0 && x < w - 1) { row += '#'; continue; }
      row += '.';
    }
    map.push(row);
  }
  const stock = mapStock({ map });
  const share = (have, frac) => Math.max(4, Math.round(have * frac));
  const goals = [];
  let base;
  if (kind === GK.SCORE) { base = 12000 + tier * 900; goals.push([GK.SCORE, 0, base]); }
  else if (kind === GK.COLLECT) {
    const a = Math.floor(r() * types);
    let b = Math.floor(r() * types); if (b === a) b = (b + 1) % types;
    const pair = collectPair(moves, types, tier);
    goals.push([GK.COLLECT, a, pair[0]]);
    goals.push([GK.COLLECT, b, pair[1]]);
    base = GEN.collect.base + tier * 500;
  }
  else if (kind === GK.MUD) { goals.push([GK.MUD, 0, share(stock.mud, .74 + tier * .05)]); base = GEN.mud.base; }
  else if (kind === GK.CRATE) { goals.push([GK.CRATE, 0, share(stock.crate, .68 + tier * .045)]); base = GEN.crate.base; }
  else if (kind === GK.RESCUE) { goals.push([GK.RESCUE, 0, 2]); base = GEN.rescue.base; }
  else { goals.push([GK.BRAMBLE, 0, GEN.bramble.goal(tier)]); base = GEN.bramble.base; }

  return normaliseGoals({
    n: DAILY_LEVEL, daily: true, day, w, h, types, moves, goals, base, map
  });
}
/* a level number no handcrafted level will ever use */
const DAILY_LEVEL = -1;

function starTargets(def) {
  const b = def.base;
  return [Math.round(b * .55), Math.round(b * .8), b];
}
