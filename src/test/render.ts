const unpack = data => {
  if (!Array.isArray(data)) return { values: data, children: [] };
  const values: any = {};
  const children: any[] = [];
  for (const { key, value } of data) {
    if (typeof key === 'string') values[key] = unpack(value).values;
    else children.push({ index: key - 1, value });
  }
  return { values, children };
};

const updateChild = (parent, index, next) => {
  const prev = parent.childNodes[index];
  if (!next) {
    if (prev) parent.removeChild(prev);
  } else if (!Array.isArray(next)) {
    const textNode = document.createTextNode(next.value);
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
        child.oninput = e => values[k].set(e.target.value);
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
    children.forEach(({ index, value }) => updateChild(child, index, value));
  }
};

export default updateChild;
