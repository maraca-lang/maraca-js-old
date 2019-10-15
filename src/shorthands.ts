export default (type, info, nodes) => {
  if (type === 'list' && !['[', '<'].includes(info.bracket)) {
    return {
      type: 'combine',
      info: { dot: true },
      nodes: [
        {
          type: 'value',
          info: {
            value: `${
              info.bracket === '('
                ? nodes.filter(n => n.type !== 'func').length
                : 1
            }`,
          },
        },
        { type: 'list', info: { bracket: '[', semi: true }, nodes },
      ],
    };
  }
  if (type === 'identity') {
    return {
      type: 'list',
      nodes: [
        {
          type: 'func',
          nodes: [null, { type: 'value', info: { value: 'v' } }],
          info: {
            body: {
              type: 'combine',
              nodes: [
                { type: 'value', info: { value: 'v' } },
                { type: 'context' },
              ],
              info: { space: [false] },
            },
          },
        },
      ],
      info: { bracket: '[' },
    };
  }
};
