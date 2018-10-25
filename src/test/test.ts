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
    lat: parseFloat(faker.address.latitude()),
    lng: parseFloat(faker.address.longitude()),
  }),
}));

const script = `
{
  fields: [First name, Last name, DOB, Score 1, Score 2],
  filter: *,
  sort: *,
  limit: *,
  formula: *,

  [class: container "mt-4",
    [:table, class: table, style: [tableDisplay: fixed],
      [:thead,
        [:tr,
          [:th, scope: col, colSpan: #"x => x.length" fields? + 2,
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
          ...
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
        ...
        data?
        [v=>> (##(filter? [:1, x=> "(" .. x? .. ")"]) v?, v?)]
        [k=> v=> [...##("[" .. sort? .. "]") v?, ##(filter?) v?, k?]: v?]
        [v=>> :: v?]
        [k=> v=> [index: k?, ...v?]]
        [k=> v=> (##(limit? [:1, x=> "(" .. x? .. ")"]) k?, v?)]
        [v=>> :: v?]
        [k=> v=>
          [:tr,
            [:th, scope: row, v? index],
            ...
            fields?
            [f=>> [:td, f? [DOB: #time f? (v?), => f? (v?)]]],
            [:td, ##(formula?) v?],
          ]
        ]
      ]
    ]
  ]
}
`;

// const script = `
// [:chart,
//   type: bar,
//   labels: [January, February, March, April, May, June, July],
//   [
//     label: My first chart,
//     backgroundColor: "rgb(255, 99, 132)",
//     borderColor: "rgb(255, 99, 132)",
//     0, 10, 5, 2, 20, 30, 45,
//   ],
// ]
// `;

// run(script, toData({ data }), data =>
//   console.log(JSON.stringify(data, null, 2)),
// );

const root = document.createElement('div');
root.id = 'root';
document.body.appendChild(root);

run(script, toData({ data }), data => render(root, data));
