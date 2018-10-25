export default (s1, s2) => {
  var matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2.0) - 1;
  var matches1 = new Array(s1.length);
  var matches2 = new Array(s2.length);
  var m = 0;
  var t = 0;
  var i = 0;
  var k = 0;

  for (i = 0; i < s1.length; i++) {
    var start = Math.max(0, i - matchWindow);
    var end = Math.min(i + matchWindow + 1, s2.length);

    for (k = start; k < end; k++) {
      if (matches2[k]) {
        continue;
      }
      if (s1[i] !== s2[k]) {
        continue;
      }

      matches1[i] = true;
      matches2[k] = true;
      m++;
      break;
    }
  }

  if (m === 0) {
    return 0.0;
  }

  k = 0;
  for (i = 0; i < s1.length; i++) {
    if (!matches1[i]) {
      continue;
    }
    while (!matches2[k]) {
      k++;
    }
    if (s1[i] !== s2[k]) {
      t++;
    }
    k++;
  }

  t = t / 2.0;

  const jaro = (m / s1.length + m / s2.length + (m - t) / m) / 3.0;

  var p = 0.1;
  var l = 0;
  while (s1[l] === s2[l] && l < 4) {
    l++;
  }
  return jaro + l * p * (1 - jaro);
};
