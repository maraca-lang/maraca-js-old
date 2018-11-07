import * as Chart from 'chart.js';
import * as loadScript from 'load-script';
import * as debounce from 'lodash.debounce';

import { history } from '../build';
import { toTypedValue } from '../data';

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

const valuesToObject = values =>
  values.reduce(
    (res, v) =>
      v.key.type === 'list' ? res : { ...res, [v.key.value || '']: v.value },
    {},
  );

const dataToJs = data => {
  if (data.type !== 'list') return data.value || null;
  return {
    indices: (data.indices || []).map(dataToJs),
    values: (data.values || []).reduce(
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

const diffValues = (next = [] as any[], prev = [] as any[], update) => {
  const n = valuesToObject(next);
  const p = valuesToObject(prev);
  for (const k of Array.from(new Set([...Object.keys(n), ...Object.keys(p)]))) {
    if (!shallowEqual(n[k], p[k])) {
      update(k, n[k], p[k]);
    }
  }
};

const modes = {
  '': {
    create: ({ value }) => document.createTextNode(value),
    transform: node => node,
    update: (node, { value }) => (node.nodeValue = value),
    destroy: () => {},
  },
  dom: {
    create: ({ tag }) => document.createElement(tag),
    transform: (node, { tag }) => {
      if (tag !== node.nodeName.toLowerCase()) {
        const newNode = document.createElement(tag);
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          const hasFocus = document.activeElement === node.childNodes[i];
          newNode.insertBefore(node.childNodes[i], newNode.childNodes[0]);
          if (hasFocus) node.childNodes[i].focus();
        }
        return newNode;
      }
      return node;
    },
    update: (node, next, prev) => {
      diffValues(
        [
          ...(next.tag === 'a'
            ? [
                {
                  key: { type: 'value', value: 'href' },
                  value: { type: 'nil' },
                },
              ]
            : []),
          ...next.values,
        ],
        prev.values,
        (k, v, p) => {
          if (k === 'value' && v.set) {
            node.oninput = debounce(e => v.set(e.target.value), 1000);
          }
          if (k === 'style') {
            diffValues(v && v.values, p && p.values, (k, v) => {
              node.style[k] = v.value || '';
            });
          } else if (k === 'class') {
            node.className = v.value || '';
          } else if (k === 'href') {
            const url = `/${v.type === 'value' ? v.value : ''}`;
            node.href = url;
            node.onclick = e => {
              e.preventDefault();
              history.push(url);
            };
          } else {
            node[k] = v.value || '';
          }
        },
      );
      const children = [...node.childNodes];
      const dataPairs = next.indices.map(v => {
        const i = children.findIndex(c => c.__data.id === v.id);
        if (i === -1) return { data: v };
        return { child: children.splice(i, 1)[0], data: v };
      });
      [
        ...dataPairs,
        ...children.map(child => ({ child, data: { type: 'nil' } })),
      ].forEach(({ child, data }, i) => render(node, child, data, i));
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
                    0,
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
  if (tag === '') return '';
  return 'dom';
};

const render = (parent, child, data, index) => {
  if (data.type === 'nil') {
    if (child) {
      if (child.__data) {
        const mode = getMode(child.__data.tag);
        modes[mode].destroy(child);
      }
      parent.removeChild(child);
    }
  } else {
    const d = { id: data.id } as any;
    if (data.type === 'value') {
      d.tag = '';
      d.value = data.value;
    } else if (data.type === 'list') {
      d.indices = data.indices;
      d.values = [...data.values];
      d.tag =
        d.values.length > 0 && d.values[d.values.length - 1].key.type === 'nil'
          ? d.values.pop().value.value
          : 'div';
    }
    let node = child;
    const prevMode = node && getMode(node.__data.tag);
    const mode = getMode(d.tag);
    const hasFocus = node && document.activeElement === node;
    if (mode !== prevMode) node = modes[mode].create(d);
    else node = modes[mode].transform(node, d);
    if (!child) {
      parent.appendChild(node);
    } else if (node !== child) {
      if (prevMode) modes[prevMode].destroy(child);
      parent.replaceChild(node, child);
    }
    if (node !== parent.childNodes[index]) {
      parent.insertBefore(node, parent.childNodes[index]);
    }
    if (hasFocus) node.focus();
    modes[mode].update(node, d, node.__data || {});
    node.__data = d;
  }
  return parent;
};

export default (node, data) => render(node, node.childNodes[0], data, 0);
