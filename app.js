// Словоград — сложи најдужу реч из понуђених слова.
// Чист JS без зависности; logika je odvojena od DOM-a radi testiranja.

/* ═══════════ Чиста логика (тестабилна и ван browsera) ═══════════ */

const CYR = 'абвгдђежзијклмнопрстћуфхцчџш';
const CYR_INDEX = new Map([...CYR].map((ch, i) => [ch, i]));
const VOWELS = new Set('аеиоу');
const TOTAL_ROUNDS = 5;
const ROUND_SECONDS = 60;
const LETTERS_PER_ROUND = 12;
const MIN_WORD_LEN = 3;
const PANGRAM_BONUS = 3;

const WORDS = (typeof window !== 'undefined' && window.SLOVOGRAD_WORDS
  ? window.SLOVOGRAD_WORDS
  : ''
).split('\n').filter(Boolean);
const WORD_SET = new Set(WORDS);

// Тежине слова за допуну — из стварне учесталости у речнику (првих 20.000).
const LETTER_WEIGHTS = (() => {
  const counts = new Array(CYR.length).fill(0);
  for (const w of WORDS.slice(0, 20000)) {
    for (const ch of w) counts[CYR_INDEX.get(ch)] += 1;
  }
  return CYR.split('').map((ch, i) => ({ ch, weight: counts[i] + 1 }));
})();

const WEIGHTED_POOL = (() => {
  const pool = [];
  for (const { ch, weight } of LETTER_WEIGHTS) {
    // ротационо дуплирање да тежина буде целобројна а компактна
    let n = Math.max(1, Math.round(weight / 300));
    for (let i = 0; i < n; i++) pool.push(ch);
  }
  return pool;
})();

// Семе рунде = реална реч која гарантује решење; довољно честа да буде "нађiva".
const SEEDS = WORDS.slice(0, 25000).filter(
  (w) => w.length >= 8 && w.length <= 10 && [...w].filter((c) => VOWELS.has(c)).length >= 3
);

function countsOf(str) {
  const counts = new Array(CYR.length).fill(0);
  for (const ch of str) counts[CYR_INDEX.get(ch)] += 1;
  return counts;
}

function canBuild(word, letterCounts) {
  const wc = countsOf(word);
  for (let i = 0; i < CYR.length; i++) {
    if (wc[i] > letterCounts[i]) return false;
  }
  return true;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Прави 12 слова: семе (8–10) + допуне; брине о броју самогласника.
function buildLetters(usedSeeds, rand = Math.random) {
  let seed;
  for (let tries = 0; tries < 50; tries++) {
    const candidate = SEEDS[Math.floor(rand() * SEEDS.length)];
    if (!usedSeeds || !usedSeeds.has(candidate)) {
      seed = candidate;
      break;
    }
  }
  if (!seed) seed = SEEDS[0];

  const letters = [...seed];
  const seedLen = seed.length;
  const isVowel = (ch) => VOWELS.has(ch);
  while (letters.length < LETTERS_PER_ROUND) {
    const filler = WEIGHTED_POOL[Math.floor(rand() * WEIGHTED_POOL.length)];
    letters.push(filler);
  }
  // држи самогласнике у опсегу 4–7, али само мењајући допуне — семе мора остати изводиво
  let vowels = letters.filter(isVowel).length;
  while (vowels < 4) {
    const idx = letters.findIndex((ch, i) => i >= seedLen && !isVowel(ch));
    if (idx === -1) break;
    letters[idx] = randomFrom('аеио'.split(''));
    vowels += 1;
  }
  while (vowels > 7) {
    const idx = letters.findIndex((ch, i) => i >= seedLen && isVowel(ch));
    if (idx === -1) break;
    letters[idx] = 'р';
    vowels -= 1;
  }

  // мешање (Fisher–Yates)
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return { letters, seed };
}

// Најдуже речи које се могу сложити из понуђених слова,
// сортирано по дужини, а унутар дужине по учесталости.
// Прихвата низ знакова, низ објеката { ch } или стринг.
function findBest(letters, limit = 6) {
  const chars = typeof letters === 'string'
    ? letters
    : letters.map((t) => (typeof t === 'string' ? t : t.ch)).join('');
  const counts = countsOf(chars);
  const buckets = [];
  for (const w of WORDS) {
    if (w.length < 5) continue; // ниже речи не приказујемо у "могло је"
    if (w.length > chars.length) continue;
    if (canBuild(w, counts)) {
      (buckets[w.length] ||= []).push(w);
    }
  }
  const top = [];
  for (let len = buckets.length - 1; len >= 0 && top.length < limit; len--) {
    if (buckets[len]) top.push(...buckets[len].slice(0, limit - top.length));
  }
  const bestLen = (() => {
    for (let len = buckets.length - 1; len >= 0; len--) {
      if (buckets[len] && buckets[len].length) return len;
    }
    return 0;
  })();
  return { top, bestLen };
}

const TIPS = [
  'Крени од суфикса: -АТИ, -ИТИ, -ОСТ, -СТВО, -ИЦА, -НИК, -АЧ. Ако их видиш међу словима, гради реч уназад од наставка.',
  'Погледај префиксе: ПО-, ЗА-, НА-, ДО-, ИЗ-, ПРЕ-, ПРА-. Од кратке речи праве дугу: ЧИТАТИ → ПРОЧИТАТИ, РАД → САРАДНИК.',
  'Преброј самогласнике (А, Е, И, О, У). Ако их имаш четири и више — дуга реч сигурно постоји. Тражи је.',
  'Ретка слова (Љ, Њ, Џ, Ђ, Ћ) су сидро: могу да стоје само у одређеним речима. Крени од њих: СТАЊЕ, ЉУБАВ, ЏАК, ЋУТАТИ.',
  'Слогови држе заједно: СТ, ПР, ТР, КР, СК, ЗД, РА, ЛА, ОВ. Прво споји један пар, па гради остало око њега.',
  'Не тражи одмах најдужу реч — сложи две-три средње (4–6 слова) да загрејеш, па онда спајај у дугу.',
  'Ако застанеш, погледај која слова НЕ користиш: ту се често крије префикс или суфикс који продужује реч.',
  'Размишљај породицама речи: од корена МИСЛ градиш МИСЛИТИ, ЗАМИСЛИТИ, ДОМИШЉАТИ, ПРЕМИШЉАТИ… један корен, много речи.',
  'Именице на -СТВО и -ОСТ су природно дуге: ЈУНАК → ЈУНАШТВО, ДРУГ → ДРУШТВО, СТАР → СТАРОСТ.',
  'Р је најсвестранији сугласник — кад немаш идеју, пробај комбинације са Р у средини: ТР-, КР-, ПР-, ВР-.',
];

function rankFor(utilization) {
  if (utilization >= 0.85) return 'Грандмајстор слова';
  if (utilization >= 0.7) return 'Мајстор слова';
  if (utilization >= 0.55) return 'Словотворац';
  if (utilization >= 0.4) return 'Вежбаник';
  return 'Почетник';
}

function adviceFor(utilization) {
  if (utilization >= 0.85) return 'Искористиш скоро сав потенцијал слова — следећи изазов је брзина: првих 20 секунди само скенирај суфиксе и префиксе, па гради без размишљања.';
  if (utilization >= 0.7) return 'Стално налазиш добре речи, али ти најдужа понекад измакне. Пре предају реци наглас два-три кандидата и потврди најдужи.';
  if (utilization >= 0.55) return 'Добра основа. Следећи корак: пре слагања одвој 5 секунди и наброј све суфиксе и префиксе које видиш међу словима — па гради од њих.';
  if (utilization >= 0.4) return 'Средње речи ти добро иду, дуге измичу. Вежбај породице речи: нађи корен од 4 слова и обиђи га префиксима (ПО-, ЗА-, ПРЕ-, ИЗ-).';
  return 'Крени од малог циља: у свакој рунди обавезно потврди једну реч од 5+ слова пре истека времена. Савет после сваке рунде ти је најјачи алат.';
}

globalThis.SlovogradCore = {
  CYR, VOWELS, TOTAL_ROUNDS, ROUND_SECONDS, LETTERS_PER_ROUND, MIN_WORD_LEN,
  WORDS, WORD_SET, SEEDS, TIPS,
  countsOf, canBuild, buildLetters, findBest, rankFor, adviceFor,
};

/* ═══════════ DOM део — покреће се само у browseru ═══════════ */

if (typeof document !== 'undefined' && document.getElementById('tiles')) {
  const $ = (id) => document.getElementById(id);

  const el = {
    game: $('game'), hudRound: $('hud-round'), hudScore: $('hud-score'), hudBest: $('hud-best'),
    timerNum: $('timer-num'), timerFill: $('timer-fill'),
    answer: $('answer'), inputHint: $('input-hint'),
    tiles: $('tiles'), btnClear: $('btn-clear'), btnBack: $('btn-back'), btnSubmit: $('btn-submit'),
    foundBest: $('found-best'), foundList: $('found-list'),
    overlayIntro: $('overlay-intro'), overlayRound: $('overlay-round'), overlayEnd: $('overlay-end'),
    overlayStrategy: $('overlay-strategy'),
    btnStart: $('btn-start'), btnNext: $('btn-next'), btnAgain: $('btn-again'),
    btnStrategy: $('btn-strategy'), btnStrategy2: $('btn-strategy-2'), btnStrategyClose: $('btn-strategy-close'),
    reYours: $('re-yours'), reYoursLen: $('re-yours-len'), rePossible: $('re-possible'),
    rePossibleLen: $('re-possible-len'), reTop: $('re-top'), reTip: $('re-tip'),
    endScore: $('end-score'), endRecord: $('end-record'), endRank: $('end-rank'),
    endConclusions: $('end-conclusions'), endRounds: $('end-rounds'),
    toast: $('toast'),
  };

  const BEST_KEY = 'slovograd.rekord';
  const state = {
    round: 0,
    score: 0,
    letters: [],        // [{ ch, used }]
    input: [],          // индекси у state.letters
    found: [],          // речи текуће рунде
    bestWord: '',       // најдужа реч текуће рунде
    scoreAtRoundStart: 0,
    possible: null,     // { top, bestLen } текуће рунде
    deadline: 0,
    timerId: null,
    pausedRemaining: null, // тајмер паузиран док је стратегија отворена
    lastFocused: null,     // фокус пре отварања overlay-а
    usedSeeds: new Set(),
    history: [],        // по рунди: { yours, yoursLen, possibleLen, possibleWord, score }
    toastId: null,
  };

  const show = (node) => node && node.removeAttribute('hidden');
  const hide = (node) => node && node.setAttribute('hidden', '');

  // Оverlay-и са управљањем фокуса (доступност): фокус у панел при отварању,
  // враћање на претходни елемент при затварању.
  function openOverlay(overlay) {
    state.lastFocused = document.activeElement;
    show(overlay);
    const panel = overlay.querySelector('.panel');
    if (panel) panel.focus();
  }

  function closeOverlay(overlay) {
    hide(overlay);
    if (state.lastFocused && document.contains(state.lastFocused)) {
      state.lastFocused.focus();
    }
    state.lastFocused = null;
  }

  function toast(msg, kind = '') {
    el.toast.textContent = msg;
    el.toast.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(state.toastId);
    state.toastId = setTimeout(() => { el.toast.className = 'toast'; }, 2200);
  }

  function loadBest() {
    let v = 0;
    try {
      v = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch { /* складиште блокирано — рекорд важи само у сесији */ }
    el.hudBest.textContent = v > 0 ? v : '—';
    return v;
  }

  /* ── Рунда ─────────────────────────────────────── */

  function startRound() {
    state.round += 1;
    state.found = [];
    state.bestWord = '';
    state.input = [];
    state.scoreAtRoundStart = state.score;

    const built = buildLetters(state.usedSeeds);
    state.usedSeeds.add(built.seed);
    state.letters = built.letters.map((ch) => ({ ch, used: false }));
    state.possible = findBest(state.letters);

    el.hudRound.textContent = `${state.round}/${TOTAL_ROUNDS}`;
    el.foundBest.textContent = 'Најдужа: —';
    el.foundList.innerHTML = '';
    el.inputHint.textContent = 'Кликни слова доле да сложиш реч';
    renderTiles();
    renderAnswer();
    closeOverlay(el.overlayRound);
    show(el.game);

    state.deadline = Date.now() + ROUND_SECONDS * 1000;
    clearInterval(state.timerId);
    tickTimer();
    state.timerId = setInterval(tickTimer, 200);
  }

  function tickTimer() {
    const msLeft = Math.max(0, state.deadline - Date.now());
    const sLeft = Math.ceil(msLeft / 1000);
    el.timerNum.textContent = sLeft;
    el.timerFill.style.width = `${(msLeft / (ROUND_SECONDS * 1000)) * 100}%`;
    const low = sLeft <= 10;
    el.timerNum.classList.toggle('low', low);
    el.timerFill.classList.toggle('low', low);
    if (msLeft <= 0) endRound();
  }

  function renderTiles() {
    el.tiles.innerHTML = '';
    state.letters.forEach((tile, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile' + (tile.used ? ' used' : '');
      btn.textContent = tile.ch;
      btn.setAttribute('aria-label', `Слово ${tile.ch}`);
      btn.addEventListener('click', () => pushLetter(i));
      el.tiles.appendChild(btn);
    });
  }

  function renderAnswer(flash) {
    el.answer.innerHTML = '';
    state.input.forEach((i) => {
      const slot = document.createElement('span');
      slot.className = 'slot' + (flash ? ' ' + flash : '');
      slot.textContent = state.letters[i].ch;
      el.answer.appendChild(slot);
    });
    if (state.input.length === 0) {
      el.inputHint.textContent = 'Кликни слова доле да сложиш реч';
    } else {
      const word = currentWord();
      el.inputHint.textContent = `${state.input.length} ${state.input.length === 1 ? 'слово' : 'слова'} — Enter за потврду`;
      if (WORD_SET.has(word)) el.inputHint.textContent += ' ✓ реч постоји';
    }
  }

  function currentWord() {
    return state.input.map((i) => state.letters[i].ch).join('');
  }

  function pushLetter(i) {
    if (state.letters[i].used) return;
    if (state.input.length >= LETTERS_PER_ROUND) return;
    state.letters[i].used = true;
    state.input.push(i);
    renderTiles();
    renderAnswer();
  }

  function popLetter() {
    const i = state.input.pop();
    if (i !== undefined) state.letters[i].used = false;
    renderTiles();
    renderAnswer();
  }

  function clearInput() {
    state.input.forEach((i) => { state.letters[i].used = false; });
    state.input = [];
    renderTiles();
    renderAnswer();
  }

  function submitWord() {
    const word = currentWord();
    if (word.length < MIN_WORD_LEN) {
      toast(`Реч мора имати бар ${MIN_WORD_LEN} слова`, 'bad');
      renderAnswer('bad');
      return;
    }
    if (!WORD_SET.has(word)) {
      toast(`„${word.toUpperCase()}“ није у речнику`, 'bad');
      renderAnswer('bad');
      return;
    }
    if (state.found.includes(word)) {
      toast('Већ нађено у овој рунди', 'bad');
      clearInput();
      return;
    }

    state.found.push(word);
    const isPangram = word.length === LETTERS_PER_ROUND;
    const becameBest = word.length > state.bestWord.length;
    if (becameBest) state.bestWord = word;

    // бодује само најдужа реч у рунди — поени се рачунају од ње
    state.score = state.scoreAtRoundStart
      + state.bestWord.length
      + (state.bestWord.length === LETTERS_PER_ROUND ? PANGRAM_BONUS : 0);
    el.hudScore.textContent = state.score;

    toast(
      isPangram && becameBest
        ? `„${word.toUpperCase()}“ — СВА СЛОВА! +${state.bestWord.length + PANGRAM_BONUS} поена`
        : becameBest
          ? `„${word.toUpperCase()}“ ✓ +${word.length} ${word.length === 1 ? 'поен' : 'поена'}`
          : `„${word.toUpperCase()}“ ✓ реч прихваћена (краћа од најдуже)`,
      isPangram && becameBest ? 'gold' : 'ok'
    );

    const chip = document.createElement('span');
    chip.className = 'chip' + (word === state.bestWord ? ' best' : '');
    chip.textContent = word;
    el.foundList.querySelectorAll('.chip').forEach((c) => c.classList.remove('best'));
    el.foundList.appendChild(chip);
    el.foundBest.textContent = `Најдужа: ${state.bestWord} (${state.bestWord.length})`;
    clearInput();
  }

  /* ── Крај рунде / крај игре ────────────────────── */

  function endRound() {
    clearInterval(state.timerId);
    clearInput();

    const yoursLen = state.bestWord.length;
    const roundScore = yoursLen + (yoursLen === LETTERS_PER_ROUND ? PANGRAM_BONUS : 0);

    state.history.push({
      yours: state.bestWord || '—',
      yoursLen,
      possibleLen: state.possible.bestLen,
      possibleWord: state.possible.top[0] || '—',
      score: roundScore,
    });

    el.reYours.textContent = state.bestWord || '—';
    el.reYoursLen.textContent = yoursLen ? `${yoursLen} слова · +${roundScore} поена` : 'ниједна реч';
    el.rePossible.textContent = state.possible.top[0] || '—';
    el.rePossibleLen.textContent = `${state.possible.bestLen} слова`;
    el.reTop.innerHTML = '';
    for (const w of state.possible.top) {
      const li = document.createElement('li');
      li.textContent = w;
      const em = document.createElement('em');
      em.textContent = `${w.length}`;
      li.appendChild(em);
      el.reTop.appendChild(li);
    }
    el.reTip.textContent = TIPS[(state.round - 1) % TIPS.length];
    el.btnNext.textContent = state.round >= TOTAL_ROUNDS ? 'Види резултат' : 'Следећа рунда';
    hide(el.game);
    openOverlay(el.overlayRound);
  }

  function endGame() {
    closeOverlay(el.overlayRound);

    const foundTotal = state.history.reduce((s, r) => s + r.yoursLen, 0);
    const possibleTotal = state.history.reduce((s, r) => s + r.possibleLen, 0);
    const utilization = possibleTotal ? foundTotal / possibleTotal : 0;
    const longest = state.history.reduce((a, r) => (r.yoursLen > a.yoursLen ? r : a), state.history[0]);

    el.endScore.textContent = state.score;

    const prevBest = loadBest();
    if (state.score > prevBest) {
      try {
        localStorage.setItem(BEST_KEY, String(state.score));
      } catch { /* игнориши — приказ резултата и даље важи */ }
      loadBest();
      el.endRecord.textContent = 'Нови рекорд! 🏆';
      el.endRecord.className = 'score-line new-record';
    } else {
      el.endRecord.textContent = `Рекорд остаје: ${prevBest || 0} поена`;
      el.endRecord.className = 'score-line';
    }

    el.endRank.textContent = `${rankFor(utilization)} · ${Math.round(utilization * 100)}% искоришћеног потенцијала`;

    const missed = state.history
      .filter((r) => r.yoursLen < r.possibleLen)
      .slice(0, 3)
      .map((r) => `„${r.possibleWord}“ (${r.possibleLen})`);

    const items = [];
    items.push(
      longest && longest.yoursLen > 0
        ? `Најдужа реч коју си сложио: „${longest.yours}“ (${longest.yoursLen} слова).`
        : 'Ниси сложио ниједну реч — крени спорије и прво потражи суфиксе (-АТИ, -ОСТ, -ИЦА).'
    );
    if (missed.length) {
      items.push(`Измакле су ти: ${missed.join(', ')}. Прочитај како су грађене — то су твоје следеће речи.`);
    }
    items.push(adviceFor(utilization));
    el.endConclusions.innerHTML = '';
    for (const text of items) {
      const li = document.createElement('li');
      li.textContent = text;
      el.endConclusions.appendChild(li);
    }

    el.endRounds.innerHTML = '';
    for (const [i, r] of state.history.entries()) {
      const tr = document.createElement('tr');
      for (const v of [i + 1, r.yours, `${r.possibleWord} (${r.possibleLen})`, r.score]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      el.endRounds.appendChild(tr);
    }

    openOverlay(el.overlayEnd);
  }
  /* ── Догађаји ──────────────────────────────────── */

  el.btnStart.addEventListener('click', () => {
    closeOverlay(el.overlayIntro);
    state.round = 0;
    state.score = 0;
    state.usedSeeds.clear();
    state.history = [];
    el.hudScore.textContent = '0';
    startRound();
  });

  el.btnNext.addEventListener('click', () => {
    if (state.round >= TOTAL_ROUNDS) endGame();
    else startRound();
  });

  el.btnAgain.addEventListener('click', () => {
    closeOverlay(el.overlayEnd);
    state.round = 0;
    state.score = 0;
    state.usedSeeds.clear();
    state.history = [];
    el.hudScore.textContent = '0';
    startRound();
  });

  el.btnClear.addEventListener('click', clearInput);
  el.btnBack.addEventListener('click', popLetter);
  el.btnSubmit.addEventListener('click', submitWord);

  // Стратегија за време рунде паузира тајмер, али само ако рунда траје
  function openStrategy() {
    if (!el.game.hasAttribute('hidden') && state.timerId !== null) {
      state.pausedRemaining = state.deadline - Date.now();
      clearInterval(state.timerId);
      state.timerId = null;
    }
    openOverlay(el.overlayStrategy);
  }

  function closeStrategy() {
    closeOverlay(el.overlayStrategy);
    if (state.pausedRemaining !== null) {
      state.deadline = Date.now() + state.pausedRemaining;
      state.pausedRemaining = null;
      state.timerId = setInterval(tickTimer, 200);
    }
  }

  el.btnStrategy.addEventListener('click', openStrategy);
  el.btnStrategy2.addEventListener('click', openStrategy);
  $('btn-strategy-intro').addEventListener('click', openStrategy);
  el.btnStrategyClose.addEventListener('click', closeStrategy);

  document.addEventListener('keydown', (e) => {
    if (!el.overlayStrategy.hasAttribute('hidden')) {
      if (e.key === 'Escape') closeStrategy();
      return;
    }
    if (el.game.hasAttribute('hidden')) return;
    if (e.key === 'Backspace') { e.preventDefault(); popLetter(); }
    else if (e.key === 'Enter') { e.preventDefault(); submitWord(); }
    else if (e.key === 'Escape') clearInput();
    else {
      const ch = e.key.toLowerCase();
      if ([...ch].length === 1 && CYR.includes(ch)) {
        const i = state.letters.findIndex((t) => !t.used && t.ch === ch);
        if (i !== -1) pushLetter(i);
      }
    }
  });

  loadBest();
  // фокус на intro панел да је табовање одмах у дијалогу
  const introPanel = el.overlayIntro.querySelector('.panel');
  if (introPanel) introPanel.focus();
}
