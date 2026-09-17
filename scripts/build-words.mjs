// Gradi rečnik za Словоград из OpenSubtitles frequency liste za srpski.
// Izvor: https://github.com/hermitdave/FrequencyWords (content/2018/sr/)
// Upotreba: node scripts/build-words.mjs data/sr_full.txt
//
// Koraci: transliteracija latinica->ćirilica, filter na čisto srpsko
// ćirilično slovo (3-12 znakova), prag učestalosti, dedup, cap.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CYR = new Set('абвгдђежзијклмнопрстћуфхцчџш');

// dvografi prvo, pa jednoznačна slova.
// NAPOMENA: "dj" je dvosmislen (đ vs d+j: ovdje→овде, odjek→одјек),
// pa se latinicne reči sa "dj" preskaču — ćirilični oblici dolaze iz korpusa.
const LATIN_TO_CYR = [
  ['dž', 'џ'], ['lj', 'љ'], ['nj', 'њ'],
  ['a', 'а'], ['b', 'б'], ['c', 'ц'], ['č', 'ч'], ['ć', 'ћ'], ['d', 'д'],
  ['đ', 'ђ'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], ['i', 'и'],
  ['j', 'ј'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'],
  ['p', 'п'], ['r', 'р'], ['s', 'с'], ['š', 'ш'], ['t', 'т'], ['u', 'у'],
  ['v', 'в'], ['z', 'з'], ['ž', 'ж'],
];

function translit(word) {
  if (word.includes('dj')) return null; // dvosmislen digraf — preskoči
  let out = '';
  let i = 0;
  while (i < word.length) {
    let matched = false;
    for (const [lat, cyr] of LATIN_TO_CYR) {
      if (word.startsWith(lat, i)) {
        out += cyr;
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (!matched) return null; // sadrži znak van srpske latinice
  }
  return out;
}

const MIN_COUNT = 8;   // prag učestalosti (protiv tipfelera)
const MAX_WORDS = 60000;
const MIN_LEN = 3;
const MAX_LEN = 12;

// ne-standardni oblici iz korpusa: hrvatske/ijekavske varijante i
// hibridna latinična "gđa"-porodica (u ćirilici nema niza "гђ")
const BLOCKLIST = new Set(['овдје', 'гдје', 'видјети']);
const BLOCK_PATTERNS = [/гђ/];

const input = process.argv[2];
if (!input) {
  console.error('Upotreba: node scripts/build-words.mjs <sr_full.txt>');
  process.exit(1);
}

const seen = new Set();
const words = [];
for (const line of readFileSync(input, 'utf8').split('\n')) {
  const sp = line.lastIndexOf(' ');
  if (sp === -1) continue;
  const raw = line.slice(0, sp);
  const count = Number(line.slice(sp + 1));
  if (!Number.isFinite(count) || count < MIN_COUNT) continue;
  if (raw.length < MIN_LEN || raw.length > MAX_LEN + 3) continue;

  let word = null;
  if ([...raw].every((ch) => CYR.has(ch))) {
    word = raw;
  } else if (/^[a-zčćđšž]+$/.test(raw)) {
    word = translit(raw);
  }
  if (!word) continue;
  if (word.length < MIN_LEN || word.length > MAX_LEN) continue;
  if ([...word].some((ch) => !CYR.has(ch))) continue;
  if (BLOCKLIST.has(word) || BLOCK_PATTERNS.some((re) => re.test(word))) continue;
  if (seen.has(word)) continue;
  seen.add(word);
  words.push(word);
  if (words.length >= MAX_WORDS) break;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
writeFileSync(join(root, 'data', 'words.txt'), words.join('\n') + '\n');
writeFileSync(
  join(root, 'data', 'words.js'),
  '// Automatski generisano iz OpenSubtitles frequency liste — scripts/build-words.mjs\n' +
  'window.SLOVOGRAD_WORDS = ' + JSON.stringify(words.join('\n')) + ';\n'
);

const byLen = {};
for (const w of words) byLen[w.length] = (byLen[w.length] || 0) + 1;
console.log('Ukupno reči:', words.length);
console.log('Raspodela po dužini:', byLen);
console.log('Prvih 10:', words.slice(0, 10).join(', '));
console.log('Primeri 8+ slova:', words.filter((w) => w.length >= 8).slice(0, 15).join(', '));
