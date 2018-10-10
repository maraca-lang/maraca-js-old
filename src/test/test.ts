import * as faker from 'faker';

import run from '../index';

import convert from './convert';
import render from './render';

const data = Array.from({ length: 10 }).map(() => ({
  'First name': faker.name.firstName(),
  'Last name': faker.name.lastName(),
  DOB: faker.date.past(30),
}));

const script = `
{
  fields: [First name, Last name, DOB],

  [class: container "mt-5",
    [:table, class: table,
      [:thead,
        [:tr,
          [:th, scope: col, "#"],
          ..
          fields?
          [=>> [:th, scope: col, ?]],
        ]
      ],
      [:tbody,
        ..
        data?
        [k=> v=>
          [:tr,
            [:th, scope: row, k?],
            ..
            fields?
            [f=>> [:td, f? (v?)]],
          ]
        ]
      ]
    ]
  ]
}
`;

const root = document.createElement('div');
root.id = 'root';
document.body.appendChild(root);

run(script, convert({ data }), data => render(root, 0, data));

// run(script, convert({ data }), data =>
//   console.log(JSON.stringify(data, null, 2)),
// );
