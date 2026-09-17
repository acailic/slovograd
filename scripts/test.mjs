// Тестови чисте логике Словограда — node scripts/test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// речник се убацива пре app.js као да смо у browseru
globalThis.window = {
  SLOVOGRAD_WORDS: readFileSync(new URL('../data/words.txt', import.meta.url), 'utf8').trim(),
};

await import('../app.js');
const C = globalThis.SlovogradCore;
assert.ok(C, 'SlovogradCore изложен');

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
};

console.log('Речник');
test('учитан и довољно велики', () => {
  assert.ok(C.WORDS.length > 50000, `имамо ${C.WORDS.length}`);
});
test('све речи чиста ћирилица, дужина 3–12', () => {
  const re = /^[абвгдђежзијклмнопрстћуфхцчџш]{3,12}$/;
  for (const w of C.WORDS) assert.match(w, re, `реч „${w}“ не пролази филтер`);
});
test('честе речи постоје у речнику', () => {
  for (const w of ['реч', 'слово', 'игра', 'град', 'вероватно', 'овде', 'где', 'одједном']) {
    assert.ok(C.WORD_SET.has(w), `недостаје „${w}“`);
  }
});
test('ne-standardni oblici nisu u rečniku', () => {
  // transliteracione greške (dj→ђ) i hrvatske/hibridne forme iz korpusa
  for (const w of ['овђе', 'гђе', 'ођедном', 'овдје', 'гдје', 'видјети', 'градјанин', 'ињекција', 'гђа']) {
    assert.ok(!C.WORD_SET.has(w), `ne-reč „${w}“ je u rečniku`);
  }
});

console.log('canBuild / countsOf');
test('мултисет поштује бројност слова', () => {
  assert.ok(C.canBuild('мама', C.countsOf('мама')));
  assert.ok(!C.canBuild('ммама', C.countsOf('мама')));
  assert.ok(C.canBuild('струк', C.countsOf('руксту')));
  assert.ok(!C.canBuild('струк', C.countsOf('рукс'))); // недостаје „т“
});

console.log('buildLetters');
test('12 слова, 4–7 самогласника, семе изводиво', () => {
  for (let i = 0; i < 200; i++) {
    const { letters, seed } = C.buildLetters(null);
    assert.equal(letters.length, C.LETTERS_PER_ROUND);
    const vowels = letters.filter((ch) => C.VOWELS.has(ch)).length;
    assert.ok(vowels >= 4 && vowels <= 7, `${vowels} самогласника: ${letters.join('')}`);
    assert.ok(C.canBuild(seed, C.countsOf(letters.join(''))), `семе „${seed}“ није изводиво из ${letters.join('')}`);
    assert.ok(seed.length >= 8 && seed.length <= 10);
  }
});
test('детерминистички rand не ломи ништа', () => {
  let x = 1;
  const rand = () => (x = (x * 48271) % 2147483647) / 2147483647;
  const { letters } = C.buildLetters(new Set(), rand);
  assert.equal(letters.length, 12);
});

console.log('findBest');
test('прихвата објекте { ch } као и стрингове', () => {
  const fromObjs = C.findBest('вероватно'.split('').map((ch) => ({ ch })));
  const fromStr = C.findBest('вероватно');
  assert.equal(fromObjs.bestLen, fromStr.bestLen);
});
test('најдужа могућа ≥ дужина семена', () => {
  const letters = 'вероватно'.split('');
  while (letters.length < 12) letters.push('а');
  const { bestLen, top } = C.findBest(letters);
  assert.ok(bestLen >= 9, `bestLen=${bestLen}`);
  assert.ok(top.length > 0 && top.length <= 6);
  assert.ok(top.every((w) => C.canBuild(w, C.countsOf(letters.join('')))));
});
test('панграм од 12 слова се препознаје као решење', () => {
  const w = C.WORDS.find((x) => x.length === 12);
  const { bestLen } = C.findBest(w.split(''));
  assert.equal(bestLen, 12, `реч „${w}“ треба бити нађива`);
});
test('не нуди дуже од понуђених слова', () => {
  const { top } = C.findBest('прстак');
  assert.ok(top.every((w) => w.length <= 6));
});

console.log('Савети и рангови');
test('савети без латиничних знакова (чиста ћирилица)', () => {
  for (const tip of [...C.TIPS, C.adviceFor(0.2), C.adviceFor(0.5), C.adviceFor(0.75), C.adviceFor(0.9)]) {
    assert.doesNotMatch(tip, /[a-zA-Z]/, `латинични знакови у: „${tip}“`);
  }
});
test('рангови по праговима', () => {
  assert.equal(C.rankFor(0.9), 'Грандмајстор слова');
  assert.equal(C.rankFor(0.75), 'Мајстор слова');
  assert.equal(C.rankFor(0.6), 'Словотворац');
  assert.equal(C.rankFor(0.45), 'Вежбаник');
  assert.equal(C.rankFor(0.2), 'Почетник');
});

console.log(`\nСви тестови прошли: ${passed}`);
