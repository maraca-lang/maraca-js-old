import * as faker from 'faker';

import run from '../index';

import convert from './convert';
import render from './render';

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
          [:th, scope: col, colSpan: #"x => x.length" fields? + 1,
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
        [k=> v=> ##(sort?) v? | k?: v?]
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
// {
//   formula: *,
//   [class: container "mt-4",
//     [:input,
//       class: "form-control" "form-control-sm",
//       placeholder: Enter formula,
//       value: formula?,
//     ],
//     [:p, ##(formula?) [A, B]]
//   ]
// }
// `;

// const script = `

// [a] [@now]

// `;

const root = document.createElement('div');
root.id = 'root';
document.body.appendChild(root);

run(script, convert({ data }), data => render(root, root.childNodes[0], data));

// run(script, convert({ data }), data =>
//   console.log(JSON.stringify(data, null, 2)),
// );
