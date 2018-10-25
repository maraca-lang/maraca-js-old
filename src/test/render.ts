import * as debounce from 'lodash.debounce';

const valueToString = value => {
  if (value === null) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }
  if (Object.prototype.toString.call(value) === '[object Object]') {
    return JSON.stringify(value);
  }
  return `${value}`;
};

const unpackValue = ({ value, set }) => {
  if (!Array.isArray(value)) return { value, set };
  return {
    value: value.reduce(
      (res, { key, value, set }) => ({
        ...res,
        [key]: unpackValue({ value, set }),
      }),
      {},
    ),
    set,
  };
};

const unpack = data => {
  if (!Array.isArray(data)) return { values: data, children: [] };
  const values: any = {};
  const children: any[] = [];
  for (const { key, value, set } of data) {
    if (typeof key === 'number' || Math.floor(key) === key) {
      children.push({ index: key - 1, value });
    } else {
      values[key || ''] = unpackValue({ value, set });
    }
  }
  return { values, children };
};

const updateChild = (parent, prev, next) => {
  if (next === null) {
    if (prev) parent.removeChild(prev);
  } else if (!Array.isArray(next)) {
    const textNode = document.createTextNode(valueToString(next));
    if (!prev) parent.appendChild(textNode);
    else parent.replaceChild(textNode, prev);
  } else {
    const {
      values: { '': tag, ...values },
      children,
    } = unpack(next);
    let child = prev;
    if (!child) {
      child = document.createElement(tag ? tag.value : 'div');
      parent.appendChild(child);
    } else if (tag) {
      child = document.createElement(tag.value || 'div');
      for (let i = prev.childNodes.length - 1; i >= 0; i--) {
        child.insertBefore(prev.childNodes[i], child.childNodes[0]);
      }
      parent.replaceChild(child, prev);
    }
    Object.keys(values).forEach(k => {
      if (k === 'value' && values[k].set) {
        child.oninput = debounce(e => values[k].set(e.target.value), 1000);
      }
      if (k === 'style') {
        Object.keys(values[k].value).forEach(p => {
          child.style[p] = values[k].value[p].value || '';
        });
      } else if (k === 'class') {
        child.className = values[k].value || '';
      } else {
        child[k] = values[k].value || '';
      }
    });
    const childrenNodes = children.map(c => child.childNodes[c.index]);
    children.forEach(({ value }, i) =>
      updateChild(child, childrenNodes[i], value),
    );
  }
};

export default updateChild;
