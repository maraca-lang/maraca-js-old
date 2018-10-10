// import run from '../index';

// const script = `
// {
//   x:= *,
//   [
//     [input:=1, value:=x?],
//     x?,
//   ]
// }
// `;

// const createTable = input => {
//   const div = document.createElement(input ? 'input' : 'div');
//   div.style.border = `1px solid ${input ? 'blue' : 'red'}`;
//   div.style.margin = '5px 0px';
//   div.style.padding = '5px 10px';
//   div.style.display = 'block';
//   div.style.fontSize = '20px';
//   div.style.fontFamily = 'Arial';
//   return div;
// };

// const createText = text => {
//   const p = document.createElement('p');
//   p.innerText = text;
//   p.style.padding = '5px 0px';
//   p.style.fontSize = '20px';
//   p.style.fontFamily = 'Arial';
//   return p;
// };

// const unpack = data => {
//   const values: any = {};
//   const children: any[] = [];
//   for (const { key, value } of data) {
//     if (typeof key === 'string') values[key] = value;
//     else children.push({ index: key - 1, value });
//   }
//   return { values, children };
// };

// const unpackValue = value => {
//   if (value === Object(value)) return value;
//   return { value };
// };

// const updateChild = (node, index, next) => {
//   const prev = node.childNodes[index];
//   if (!next) {
//     node.removeChild(prev);
//   } else if (!Array.isArray(next)) {
//     const textNode = createText(unpackValue(next).value);
//     if (!prev) node.appendChild(textNode);
//     else node.replaceChild(textNode, prev);
//   } else {
//     const { values: nextValues, children: nextChildren } = unpack(next);
//     let child = prev;
//     if (!child) {
//       child = createTable(nextValues.input);
//       node.appendChild(child);
//     } else if (nextValues.input !== undefined) {
//       child = createTable(nextValues.input);
//       node.replaceChild(child, prev);
//     }
//     Object.keys(nextValues).forEach(k => {
//       const { value, set } = unpackValue(nextValues[k]);
//       if (k !== 'input') {
//         if (set && k === 'value') {
//           child.oninput = e => set(e.target.value);
//         }
//         child.setAttribute(k, value || '');
//       }
//     });
//     nextChildren.forEach(({ index, value }) =>
//       updateChild(child, index, value),
//     );
//   }
// };

// const root = document.createElement('div');
// root.style.padding = '5px 10px';
// document.body.appendChild(root);

// run(script, data => {
//   updateChild(root, 0, data);
// });

import run from '../index';

const script = `

[=>> ? + 1] [x:= 3]

`;

run(script, data => console.log(JSON.stringify(data, null, 2)));
