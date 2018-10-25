import * as debounce from 'lodash.debounce';
import * as Chart from 'chart.js';

import { toTypedValue } from './data';

const unpack = ({ type, value, set }: any, shallow?) => {
  if (type !== 'list') return shallow ? { value: value || null, set } : value;
  const values: any = {};
  const children: any[] = [];
  for (const { key: k, value: v } of value.values) {
    const key = toTypedValue(k);
    if (key.type === 'integer') children.push(shallow ? v : unpack(v, shallow));
    else values[key.value || ''] = unpack(v, shallow);
  }
  return shallow ? { values, children, set } : { values, children };
};

const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!b.hasOwnProperty(k)) return false;
    if (a[k] !== b[k]) return false;
  }
  return true;
};

const diffValues = (next = {}, prev = {}, update) => {
  for (const k of Array.from(
    new Set([...Object.keys(next), ...Object.keys(prev)]),
  )) {
    if (!shallowEqual(next[k], prev[k])) {
      update(k, next[k], prev[k]);
    }
  }
};

const modes = {
  dom: {
    create: tag => document.createElement(tag),
    transform: (node, tag) => {
      if (tag !== node.nodeName.toLowerCase()) {
        const newNode = document.createElement(tag);
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          newNode.insertBefore(node.childNodes[i], newNode.childNodes[0]);
        }
        return newNode;
      }
      return node;
    },
    update: (node, next, prev) => {
      const n = unpack({ type: 'list', value: { values: next } }, true);
      const p = unpack({ type: 'list', value: { values: prev } }, true);
      diffValues(n.values, p.values, (k, v, p) => {
        if (k === 'value' && v.set) {
          node.oninput = debounce(e => v.set(e.target.value), 1000);
        }
        if (k === 'style') {
          diffValues(v && v.values, p && p.values, (k, v) => {
            node.style[k] = v.value || '';
          });
        } else if (k === 'class') {
          node.className = v.value || '';
        } else {
          node[k] = v.value || '';
        }
      });
      const childPairs = Array.from({
        length: Math.max(node.childNodes.length, n.children.length),
      }).map((_, i) => ({
        child: node.childNodes[i],
        data: n.children[i] || { type: 'nil' },
      }));
      for (const { child, data } of childPairs) {
        render(node, child, data);
      }
    },
    destroy: () => {},
  },
  chart: {
    create: () => {
      const node = document.createElement('div');
      node.appendChild(document.createElement('canvas'));
      return node;
    },
    transform: node => node,
    update: (node, next, prev) => {
      const n = unpack({ type: 'list', value: { values: next } }, false);
      const {
        type,
        labels: { children: labels },
      } = n.values;
      const datasets = n.children.map(x => ({
        ...x.values,
        data: x.children,
      }));
      const p = unpack({ type: 'list', value: { values: prev } }, false);
      if (p.values.type === type) {
        node.__chart.data = { labels, datasets };
        node.__chart.update();
      } else {
        if (node.__chart) node.__chart.destroy();
        node.__chart = new Chart(node.childNodes[0], {
          type,
          data: { labels, datasets },
          options: { animation: false },
        });
      }
    },
    destroy: node => {
      node.__chart.destroy();
    },
  },
} as any;

const getMode = tag => (tag === 'chart' ? 'chart' : 'dom');

const render = (parent, child, data) => {
  if (data.type === 'nil') {
    if (child) {
      if (child.__data) {
        const mode = getMode(child.__data.tag);
        modes[mode].destroy(child);
      }
      parent.removeChild(child);
    }
  } else if (data.type === 'string') {
    if (!child) {
      parent.appendChild(document.createTextNode(data.value));
    } else if (child.nodeType !== 3) {
      parent.replaceChild(document.createTextNode(data.value), child);
    } else {
      child.nodeValue = data.value;
    }
  } else {
    const values = [...data.value.values];
    const i = values.findIndex(x => x.key.type === 'nil');
    const tag = i === -1 ? 'div' : values.splice(i, 1)[0].value.value;
    let node = child;
    const prevMode = node && getMode(node.__data.tag);
    const mode = getMode(tag);
    if (mode !== prevMode) node = modes[mode].create(tag);
    node = modes[mode].transform(node, tag);
    if (!child) {
      parent.appendChild(node);
    } else if (node !== child) {
      modes[prevMode].destroy(child);
      parent.replaceChild(node, child);
    }
    modes[mode].update(node, values, node.__data ? node.__data.values : []);
    node.__data = { tag, values };
  }
};

export default (node, data) => render(node, node.childNodes[0], data);
