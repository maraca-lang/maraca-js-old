import * as Chart from 'chart.js';
import * as loadScript from 'load-script';
import * as debounce from 'lodash.debounce';

import { toTypedValue } from './data';

const mapListeners = [] as any[];
const withMapScript = onReady => {
  if ((window as any).google) {
    onReady();
  } else {
    mapListeners.push(onReady);
    if (mapListeners.length === 1) {
      loadScript(
        'https://maps.googleapis.com/maps/api/js?key=AIzaSyCQ8P7-0kTGz2_tkcHjOo0IUiMB_z9Bbp4',
        () => mapListeners.forEach(l => l()),
      );
    }
  }
};
const mapPool = [] as any[];
const linkMap = (node, onReady) => {
  withMapScript(() => {
    if (node.__mapInstance) {
      onReady(node.__mapInstance);
    } else {
      if (mapPool.length === 0) {
        const div = document.createElement('div');
        div.style.height = '100%';
        mapPool.push(new (window as any).google.maps.Map(div));
      }
      const map = mapPool.pop();
      node.appendChild(map.getDiv());
      node.__mapInstance = map;
      onReady(node.__mapInstance);
    }
  });
};
const unlinkMap = node => {
  mapPool.push(node.__mapInstance);
  node.removeChild(node.childNodes[0]);
  delete node.__mapInstance;
};

// const convertValue = ({ type, value, set }: any, options = {} as any) => {
//   const { deep = false, withSet = true } = options;
//   if (type !== 'list') {
//     return withSet ? { value: value || null, set } : value || null;
//   }
//   const values: any = {};
//   const children: any[] = [];
//   for (const { key: k, value: v } of value.values) {
//     const key = toTypedValue(k);
//     if (key.type === 'integer') {
//       children.push(deep ? convertValue(v, options) : v);
//     } else if (key.type !== 'list') {
//       values[key.value || ''] = deep ? convertValue(v, options) : v;
//     }
//   }
//   return withSet ? { values, children, set } : { values, children };
// };
// const convert = (
//   values,
//   options: { deep: boolean; withSet: boolean } = {} as any,
// ) => convertValue({ type: 'list', value: { values } }, options);

const valuesToObject = values =>
  values.reduce(
    (res, v) =>
      v.key.type === 'list' ? res : { ...res, [v.key.value || '']: v.value },
    {},
  );

const dataToJs = data => {
  if (data.type !== 'list') return data.value || null;
  return {
    indices: data.indices.map(dataToJs),
    values: data.values.reduce(
      (res, v) =>
        v.key.type === 'list'
          ? res
          : { ...res, [v.key.value || '']: dataToJs(v.value) },
      {},
    ),
  };
};

const getValue = x => {
  if (x === null || typeof x === 'string') return x;
  return Object.keys(x.values).length > 0 ? x.values : x.indices;
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

const diffValues = (next = [], prev = [], update) => {
  const n = valuesToObject(next);
  const p = valuesToObject(prev);
  for (const k of Array.from(new Set([...Object.keys(n), ...Object.keys(p)]))) {
    if (!shallowEqual(n[k], p[k])) {
      update(k, n[k], p[k]);
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
      diffValues(next.values, prev.values, (k, v, p) => {
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
        length: Math.max(node.childNodes.length, next.indices.length),
      }).map((_, i) => ({
        child: node.childNodes[i],
        data: next.indices[i] || { type: 'nil' },
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
      const n = dataToJs({ type: 'list', ...next });
      const {
        type,
        labels: { indices: labels },
      } = n.values;
      const datasets = n.indices.map(x => ({
        ...Object.keys(x.values).reduce(
          (res, k) => ({ ...res, [k]: getValue(x.values[k]) }),
          {},
        ),
        data: x.indices,
      }));
      const p = dataToJs({ type: 'list', ...prev });
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
  map: {
    create: () => {
      const node = document.createElement('div');
      node.style.height = '400px';
      return node;
    },
    transform: node => node,
    update: (node, next) => {
      linkMap(node, map => {
        if (!node.__map) {
          node.__map = {
            markers: [],
            info: new (window as any).google.maps.InfoWindow(),
          };
        }
        node.__map.markers.forEach(m => m.setMap(null));
        const bounds = new (window as any).google.maps.LatLngBounds();
        node.__map.markers = next.indices
          .map(x => {
            const loc = toTypedValue(x.indices[0]);
            if (loc.type === 'location') {
              const marker = new (window as any).google.maps.Marker({
                position: loc.value,
                map,
              });
              bounds.extend(marker.position);
              marker.addListener('click', () => {
                node.__map.info.setContent(
                  render(
                    document.createElement('div'),
                    null,
                    valuesToObject(x.values).info,
                  ),
                );
                node.__map.info.open(map, marker);
              });
              return marker;
            }
          })
          .filter(x => x);
        map.fitBounds(bounds);
        const zoom = map.getZoom();
        map.setZoom(zoom > 10 ? 10 : zoom);
      });
    },
    destroy: node => {
      node.__map.markers.forEach(m => m.setMap(null));
      node.__map.info.close();
      unlinkMap(node);
    },
  },
} as any;

const getMode = tag => {
  if (tag === 'chart') return 'chart';
  if (tag === 'map') return 'map';
  return 'dom';
};

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
    const values = [...data.values];
    const tag =
      values.length > 0 && values[values.length - 1].key.type === 'nil'
        ? values.pop().value.value
        : 'div';
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
    modes[mode].update(
      node,
      { indices: data.indices, values },
      node.__data || { indices: [], values: [] },
    );
    node.__data = { tag, indices: data.indices, values };
  }
  return parent;
};

export default (node, data) => render(node, node.childNodes[0], data);
