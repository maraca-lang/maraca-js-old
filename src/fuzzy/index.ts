import metaphone from './metaphone';
import stem from './stem';
import stopwords from './stopwords';

const occurrences = (string, subString) => {
  if (subString.length <= 0) return string.length + 1;
  let n = 0;
  let pos = 0;
  let step = subString.length;
  while (true) {
    pos = string.indexOf(subString, pos);
    if (pos >= 0) {
      ++n;
      pos += step;
    } else break;
  }
  return n;
};

const tokenize = text =>
  text
    .toLowerCase()
    .trim()
    .split(/[^a-zа-яё0-9\-']+/i)
    .filter(word => word);

const letterPairs = s =>
  Array.from({ length: s.length - 1 }).map((_, i) => s.substring(i, i + 2));

const matchPairs = (a, b) => {
  const pairs1 = [].concat(...a.map(letterPairs));
  const pairs2 = [].concat(...b.map(letterPairs));
  const total = pairs1.length + pairs2.length;
  const matches = pairs1.filter(p => {
    const match = pairs2.indexOf(p);
    if (match > -1) {
      pairs2.splice(match, 1);
      return true;
    }
  }).length;
  return (2 * matches) / total;
};

const fuzzy = (doc, search) => {
  const docTokens = tokenize(doc);
  const searchTokens = tokenize(search);

  if (docTokens.length > 10) {
    const searchStems = searchTokens.filter(s => !stopwords[s]).map(stem);
    if (searchTokens.length === 0) return 0;
    return (
      searchStems.reduce(
        (res, t) => res + occurrences(doc.toLowerCase(), t),
        0,
      ) /
      (docTokens.length * searchStems.length)
    );
  }

  let phonScore = 0;
  for (const a of docTokens.map(metaphone)) {
    for (const b of searchTokens.map(metaphone)) {
      if (a[0].includes(b[0])) phonScore += (b[0].length / a[0].length) * 0.25;
      if (a[0].includes(b[1])) phonScore += (b[1].length / a[0].length) * 0.25;
      if (a[1].includes(b[0])) phonScore += (b[0].length / a[1].length) * 0.25;
      if (a[1].includes(b[1])) phonScore += (b[1].length / a[1].length) * 0.25;
    }
  }
  phonScore /= docTokens.length * searchTokens.length;

  const pairScore = matchPairs(docTokens, searchTokens);

  console.log(doc, search, phonScore, pairScore);

  return (phonScore + pairScore) / 2;
};

export default fuzzy;
