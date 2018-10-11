import * as faker from 'faker';

import run from '../index';

import convert from './convert';
import render from './render';

const data = Array.from({ length: 30 }).map(() => ({
  'First name': faker.name.firstName(),
  'Last name': faker.name.lastName(),
  DOB: faker.date.past(30),
  'Score 1': faker.random.number(),
  'Score 2': faker.random.number(),
}));

const script = `
{
  fields: [First name, Last name, DOB, Score 1, Score 2],
  filter: *,
  sort: *,
  formula: *,

  [class: container "mt-4",
    [:table, class: table,
      [:thead,
        [:tr,
          [:th, scope: col, colSpan: 100,
            [:input,
              class: "form-control",
              placeholder: Enter filter,
              value: filter?,
            ],
            [:input,
              class: "form-control" "mt-2",
              placeholder: Enter sort,
              value: sort?,
            ],
          ],
        ],
        [:tr,
          [:th, scope: col, "#"],
          ..
          fields?
          [f=>> [:th, scope: col, f?]],
          [:th, scope: col,
            [:input,
              class: "form-control",
              placeholder: Enter formula,
              value: formula?,
            ],
          ],
        ]
      ],
      [:tbody,
        ..
        data?
        [v=>> (\` {filter?, 1}, v? \`, v?)]
        [k=> v=> { \` sort?, v? \`, k?}: v?]
        [v=>> :: v?]
        [k=> v=>
          [:tr,
            [:th, scope: row, k?],
            ..
            fields?
            [f=>> [:td, f? (v?)]],
            [:td, \` formula?, v? \`],
          ]
        ]
      ]
    ]
  ]
}
`;

// const script = `

// data?
// [k=> v=> \` {"First name? &", k?}, v? \`: v?]

// `;

const root = document.createElement('div');
root.id = 'root';
document.body.appendChild(root);

run(script, convert({ data }), data => render(root, root.childNodes[0], data));

// run(script, convert({ data }), data =>
//   console.log(JSON.stringify(data, null, 2)),
// );
