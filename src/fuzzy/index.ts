import dist from './dist';
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

const tokenize = text => text.split(/[^a-zа-яё0-9\-']+/i).filter(word => word);

const pairs = s =>
  Array.from({ length: s.length - 1 }).map((_, i) => s.substring(i, i + 2));

const fuzzy = (doc, search) => {
  const docClean = doc.toLowerCase().trim();
  const searchClean = search.toLowerCase().trim();

  const docTokens = tokenize(docClean);
  const searchTokens = tokenize(searchClean);

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

  const plainDist = dist(docClean.split(''), searchClean.split(''));

  const pairDist =
    docClean.length === 1 || searchClean.length === 1
      ? plainDist
      : dist(pairs(docClean), pairs(searchClean));

  const phonDist = dist(
    docTokens
      .map(metaphone)
      .join(' ')
      .split(''),
    searchTokens
      .map(metaphone)
      .join(' ')
      .split(''),
  );

  return plainDist * 0.3 + pairDist * 0.5 + phonDist * 0.2;
};

export default fuzzy;
