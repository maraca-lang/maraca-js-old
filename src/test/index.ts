import * as faker from 'faker';

import { toData } from '../data';
import run from '../index';

// @ts-ignore
const textJson = require('./text.json');

faker.seed(1);

const data = Array.from({ length: 30 }).map((_, i) => ({
  'First name': faker.name.firstName(),
  'Last name': faker.name.lastName(),
  DOB: faker.date.past(30),
  'Score 1': faker.random.number(),
  'Score 2': faker.random.number(),
  Movie: textJson[i] && textJson[i].overview,
  Address: JSON.stringify({
    lat: faker.random.number({ min: 51, max: 53, precision: 0.0001 }),
    lng: faker.random.number({ min: -3, max: 0, precision: 0.0001 }),
  }),
  Category: faker.helpers.randomize(['Red', 'Blue', 'Green']),
}));

// const script = `
// {
//   url: #url,
//   [
//     [
//       [:a, Home],
//       [:a, href: about, About],
//     ],
//     url? [
//       : [:p, "Hi!"],
//       about: [:p, "About!"],
//       => [:p, "Not found..."]
//     ],
//   ]
// }
// `;

const source = `
hello world
`;

run(source, toData({ data }), {}, data =>
  console.log(JSON.stringify(data, null, 2)),
);
