import * as faker from 'faker';

import { toData } from '../data';
import run from '../index';
import render from '../render';

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

const script = `
{
  fields: [First name, Last name, DOB, Category],
  filter: *,
  sort: *,
  limit: *,
  formula: *,

  data: data?
    [v=>> (##(filter? [:1, x=> "(" .. x? .. ")"]) v?, v?)]
    [k=> v=> [:: ##("[" .. sort? .. "]") v?, ##(filter?) v?, k?]: v?]
    [v=>> :: [v?]]
    [k=> v=> [index: k?, :: v?]]
    [k=> v=> (##(limit? [:1, x=> "(" .. x? .. ")"]) k?, v?)]
    [v=>> :: [v?]],

  [class: container "mt-4",
    [:table, class: table, style: [tableDisplay: fixed],
      [:thead,
        [:tr,
          [:th, scope: col, colSpan: #size fields? + 2,
            [:input,
              class: "form-control" "form-control-sm",
              placeholder: Enter filter,
              value: filter?,
            ],
            [:input,
              class: "form-control" "form-control-sm" "mt-2",
              placeholder: Enter sort,
              value: sort?,
            ],
            [:input,
              class: "form-control" "form-control-sm" "mt-2",
              placeholder: Enter limit,
              value: limit?,
            ],
          ],
        ],
        [:tr,
          [:th, scope: col, "#"],
          ::
          fields?
          [f=>> [:th, scope: col, f?]],
          [:th, scope: col, style: [width: 300px],
            [:input,
              class: "form-control" "form-control-sm",
              placeholder: Enter formula,
              value: formula?,
            ],
          ],
        ]
      ],
      [:tbody,
        ::
        data?
        [k=> v=>
          [:tr,
            [:th, scope: row, v? index],
            ::
            fields?
            [f=>> [:td, f? [DOB: #time f? (v?), => f? (v?)]]],
            [:td, ##(formula?) v?],
          ]
        ]
      ]
    ],
    [:map,
      :: data? [v=>> [v? Address, info: [:h1, v? (First name)]]]
    ],
    [:chart,
      type: pie,
      labels: [Red, Blue, Green],
      [
        label: My first chart,
        backgroundColor: [red, blue, green],
        #size data? [v=>> v? Category == Red],
        #size data? [v=>> v? Category == Blue],
        #size data? [v=>> v? Category == Green],
      ],
    ]
  ]
}
`;

// const script = `
// [[a, x: b]:: [c, x: d]]
// `;

// run(script, toData({ data }), data =>
//   console.log(JSON.stringify(data, null, 2)),
// );

const root = document.createElement('div');
root.id = 'root';
document.body.appendChild(root);

run(script, toData({ data }), data => render(root, data));
