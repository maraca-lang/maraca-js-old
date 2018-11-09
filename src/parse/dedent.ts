export default function dedent(str: string) {
  let s = str;

  // 1. Remove trailing whitespace.
  s = s.replace(/\r?\n([\t ]*)$/, '');

  // 2. Find all line breaks to determine the highest common indentation level.
  const matches = s.match(/\n[\t ]+/g) || [];

  // 3. Remove the common indentation from all strings.
  if (matches.length) {
    const size = Math.min(...matches.map(value => (value as any).length - 1));
    s = s.replace(new RegExp(`\n[\t ]{${size}}`, 'g'), '\n');
  }

  // 4. Remove leading whitespace.
  s = s.replace(/^\r?\n/, '');

  return s;
}
