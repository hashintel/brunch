const STORAGE_KEY = 'petri-editor-oracle-known-good';

let net = loadNet();
let selection = null;
let drawMode = false;
let arcSource = null;
let statusMessage = '';
let sequence = nextSequence();
let drag = null;

const root = document.querySelector('#app');
render();

function emptyNet() {
  return { places: [], transitions: [], arcs: [] };
}

function nextSequence() {
  const ids = [...net.places, ...net.transitions, ...net.arcs]
    .map((item) => Number(String(item.id).replace(/\D/gu, '')))
    .filter(Number.isFinite);
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}

function loadNet() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return emptyNet();
  try {
    return parseNet(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return emptyNet();
  }
}

function saveNet() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exportNet()));
}

function exportNet() {
  return {
    version: 1,
    places: net.places.map(({ id, label, x, y, initialTokens }) => ({
      id,
      label,
      x,
      y,
      initialTokens,
    })),
    transitions: net.transitions.map(({ id, label, x, y }) => ({ id, label, x, y })),
    arcs: net.arcs.map(({ id, source, target, weight }) => ({ id, source, target, weight })),
  };
}

function parseNet(value) {
  if (typeof value !== 'object' || value === null || value.version !== 1) invalidImport();
  if (!Array.isArray(value.places) || !Array.isArray(value.transitions) || !Array.isArray(value.arcs))
    invalidImport();
  const places = value.places.map((place) => {
    if (
      !record(place) ||
      !text(place.id) ||
      !text(place.label) ||
      !finite(place.x) ||
      !finite(place.y) ||
      !nonnegativeInteger(place.initialTokens)
    )
      invalidImport();
    return { ...place, currentTokens: place.initialTokens };
  });
  const transitions = value.transitions.map((transition) => {
    if (
      !record(transition) ||
      !text(transition.id) ||
      !text(transition.label) ||
      !finite(transition.x) ||
      !finite(transition.y)
    )
      invalidImport();
    return { ...transition };
  });
  const nodeIds = new Set([...places, ...transitions].map((node) => node.id));
  if (nodeIds.size !== places.length + transitions.length) invalidImport();
  const placeIds = new Set(places.map((place) => place.id));
  const transitionIds = new Set(transitions.map((transition) => transition.id));
  const pairs = new Set();
  const arcs = value.arcs.map((arc) => {
    if (!record(arc) || !text(arc.id) || !positiveInteger(arc.weight)) invalidImport();
    const opposite =
      (placeIds.has(arc.source) && transitionIds.has(arc.target)) ||
      (transitionIds.has(arc.source) && placeIds.has(arc.target));
    const pair = `${arc.source}\u0000${arc.target}`;
    if (!opposite || pairs.has(pair) || !nodeIds.has(arc.source) || !nodeIds.has(arc.target)) invalidImport();
    pairs.add(pair);
    return { ...arc };
  });
  if (new Set(arcs.map((arc) => arc.id)).size !== arcs.length) invalidImport();
  return { places, transitions, arcs };
}

function invalidImport() {
  throw new Error('Invalid Petri net JSON');
}

function render() {
  const selected = selectedItem();
  root.innerHTML = `
    <main role="application" aria-label="Petri net editor">
      <div class="toolbar">
        ${control('Add place')}
        ${control('Add transition')}
        ${control('Draw arc', drawMode)}
        ${control('Fire selected transition')}
        ${control('Delete selection')}
        ${control('New net')}
        ${control('Reset marking')}
        ${control('Export JSON')}
        <label class="file-control">Import JSON<input type="file" accept="application/json,.json" aria-label="Import JSON" /></label>
      </div>
      <section class="canvas" role="region" aria-label="Petri net canvas">
        ${net.arcs.map(renderArc).join('')}
        ${net.places.map((place) => renderPlace(place)).join('')}
        ${net.transitions.map((transition) => renderTransition(transition)).join('')}
      </section>
      <div class="inspector">${renderInspector(selected)}</div>
      <div role="status">${escapeHtml(statusMessage)}</div>
    </main>
  `;
  bindControls();
  bindNodes();
  bindInspector();
}

function control(name, pressed = null) {
  const pressedAttribute = pressed === null ? '' : ` aria-pressed="${String(pressed)}"`;
  return `<button type="button" data-control="${name}"${pressedAttribute}>${name}</button>`;
}

function renderPlace(place) {
  const selected = selection?.type === 'place' && selection.id === place.id ? ' selected' : '';
  return `<button type="button" class="node place${selected}" data-node-id="${place.id}" data-node-type="place" style="left:${place.x}px;top:${place.y}px" aria-label="Place: ${escapeHtml(place.label)}">${escapeHtml(place.label)} · ${place.currentTokens}</button>`;
}

function renderTransition(transition) {
  const enabled = isEnabled(transition.id);
  const selected = selection?.type === 'transition' && selection.id === transition.id ? ' selected' : '';
  return `<button type="button" class="node transition ${enabled ? 'enabled' : 'disabled'}${selected}" data-node-id="${transition.id}" data-node-type="transition" style="left:${transition.x}px;top:${transition.y}px" aria-label="Transition: ${escapeHtml(transition.label)} (${enabled ? 'enabled' : 'disabled'})">${escapeHtml(transition.label)}</button>`;
}

function renderArc(arc) {
  const source = nodeById(arc.source);
  const target = nodeById(arc.target);
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const selected = selection?.type === 'arc' && selection.id === arc.id ? ' selected' : '';
  return `<button type="button" class="arc${selected}" data-arc-id="${arc.id}" style="left:${sourceCenter.x}px;top:${sourceCenter.y}px;width:${length}px;transform:rotate(${angle}deg)" aria-label="Arc: ${escapeHtml(source.label)} to ${escapeHtml(target.label)}">${arc.weight}</button>`;
}

function renderInspector(selected) {
  if (selected === null) return '<span>No selection</span>';
  if (selected.type === 'place') {
    return `
      ${field('Label', 'text', selected.item.label)}
      ${field('Initial tokens', 'number', selected.item.initialTokens)}
      ${field('Current tokens', 'number', selected.item.currentTokens, true)}
    `;
  }
  if (selected.type === 'transition') return field('Label', 'text', selected.item.label);
  return field('Arc weight', 'number', selected.item.weight);
}

function field(name, type, value, readonly = false) {
  return `<label>${name}<input type="${type}" aria-label="${name}" value="${escapeHtml(String(value))}" ${readonly ? 'readonly' : ''} /></label>`;
}

function bindControls() {
  for (const button of root.querySelectorAll('[data-control]')) {
    button.addEventListener('click', () => handleControl(button.dataset.control));
  }
  root.querySelector('input[type=file]').addEventListener('change', importSelectedFile);
}

function handleControl(name) {
  statusMessage = '';
  if (name === 'Add place') {
    const id = `p${sequence++}`;
    const item = {
      id,
      label: `Place ${net.places.length + 1}`,
      x: 80 + net.places.length * 190,
      y: 120,
      initialTokens: 0,
      currentTokens: 0,
    };
    net.places.push(item);
    selection = { type: 'place', id };
  } else if (name === 'Add transition') {
    const id = `t${sequence++}`;
    const item = {
      id,
      label: `Transition ${net.transitions.length + 1}`,
      x: 220 + net.transitions.length * 190,
      y: 115,
    };
    net.transitions.push(item);
    selection = { type: 'transition', id };
  } else if (name === 'Draw arc') {
    drawMode = true;
    arcSource = null;
    statusMessage = 'Drag from a source node to a destination node.';
  } else if (name === 'Fire selected transition') {
    fireSelectedTransition();
  } else if (name === 'Delete selection') {
    deleteSelection();
  } else if (name === 'New net') {
    net = emptyNet();
    selection = null;
    drawMode = false;
    arcSource = null;
    sequence = 1;
    statusMessage = 'Started a new empty net.';
  } else if (name === 'Reset marking') {
    for (const place of net.places) place.currentTokens = place.initialTokens;
    statusMessage = 'Restored the initial marking.';
  } else if (name === 'Export JSON') {
    exportJson();
  }
  saveNet();
  render();
}

function bindNodes() {
  for (const node of root.querySelectorAll('[data-node-id]')) {
    node.addEventListener('pointerdown', pointerDown);
    node.addEventListener('click', () => {
      if (drag?.moved || drawMode) return;
      selection = { type: node.dataset.nodeType, id: node.dataset.nodeId };
      statusMessage = '';
      render();
    });
  }
  for (const arc of root.querySelectorAll('[data-arc-id]')) {
    arc.addEventListener('click', () => {
      selection = { type: 'arc', id: arc.dataset.arcId };
      statusMessage = '';
      render();
    });
  }
}

function pointerDown(event) {
  const element = event.currentTarget;
  if (drawMode) {
    arcSource = element.dataset.nodeId;
    statusMessage = 'Release on the destination node.';
    return;
  }
  const item = nodeById(element.dataset.nodeId);
  drag = {
    id: item.id,
    startX: event.clientX,
    startY: event.clientY,
    originX: item.x,
    originY: item.y,
    moved: false,
  };
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp, { once: true });
}

function pointerMove(event) {
  if (drag === null) return;
  const item = nodeById(drag.id);
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
  item.x = Math.max(0, drag.originX + dx);
  item.y = Math.max(0, drag.originY + dy);
  const element = root.querySelector(`[data-node-id="${item.id}"]`);
  element.style.left = `${item.x}px`;
  element.style.top = `${item.y}px`;
}

function pointerUp(event) {
  window.removeEventListener('pointermove', pointerMove);
  if (drawMode && arcSource !== null) {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-node-id]');
    finishArc(target?.dataset.nodeId ?? null);
    return;
  }
  if (drag !== null) {
    selection = { type: nodeType(drag.id), id: drag.id };
    statusMessage = '';
    drag = null;
    saveNet();
    render();
  }
}

window.addEventListener('pointerup', pointerUp);

function finishArc(targetId) {
  const sourceId = arcSource;
  arcSource = null;
  drawMode = false;
  if (targetId === null || sourceId === targetId) {
    statusMessage = 'An arc needs two different endpoints.';
    render();
    return;
  }
  const sourceType = nodeType(sourceId);
  const targetType = nodeType(targetId);
  if (sourceType === targetType) {
    statusMessage = 'Arcs must connect a place to a transition.';
    render();
    return;
  }
  if (net.arcs.some((arc) => arc.source === sourceId && arc.target === targetId)) {
    statusMessage = 'That arc already exists.';
    render();
    return;
  }
  const id = `a${sequence++}`;
  net.arcs.push({ id, source: sourceId, target: targetId, weight: 1 });
  selection = { type: 'arc', id };
  statusMessage = 'Arc created.';
  saveNet();
  render();
}

function bindInspector() {
  const label = root.querySelector('input[aria-label="Label"]');
  label?.addEventListener('change', () => {
    const selected = selectedItem();
    if (selected === null || selected.type === 'arc') return;
    if (!text(label.value)) {
      statusMessage = 'Labels cannot be empty.';
    } else {
      selected.item.label = label.value.trim();
      statusMessage = '';
      saveNet();
    }
    render();
  });
  const initial = root.querySelector('input[aria-label="Initial tokens"]');
  initial?.addEventListener('change', () => {
    const selected = selectedItem();
    const value = Number(initial.value);
    if (selected?.type !== 'place') return;
    if (!nonnegativeInteger(value)) {
      statusMessage = 'Initial tokens must be a non-negative integer.';
    } else {
      selected.item.initialTokens = value;
      selected.item.currentTokens = value;
      statusMessage = '';
      saveNet();
    }
    render();
  });
  const weight = root.querySelector('input[aria-label="Arc weight"]');
  weight?.addEventListener('change', () => {
    const selected = selectedItem();
    const value = Number(weight.value);
    if (selected?.type !== 'arc') return;
    if (!positiveInteger(value)) {
      statusMessage = 'Arc weight must be a positive integer.';
    } else {
      selected.item.weight = value;
      statusMessage = '';
      saveNet();
    }
    render();
  });
}

function fireSelectedTransition() {
  const selected = selectedItem();
  if (selected?.type !== 'transition') {
    statusMessage = 'Select a transition to fire.';
    return;
  }
  if (!isEnabled(selected.item.id)) {
    statusMessage = 'The selected transition is disabled.';
    return;
  }
  for (const arc of inputArcs(selected.item.id)) nodeById(arc.source).currentTokens -= arc.weight;
  for (const arc of outputArcs(selected.item.id)) nodeById(arc.target).currentTokens += arc.weight;
  statusMessage = 'Transition fired.';
}

function isEnabled(transitionId) {
  return inputArcs(transitionId).every((arc) => nodeById(arc.source).currentTokens >= arc.weight);
}

function inputArcs(transitionId) {
  return net.arcs.filter((arc) => arc.target === transitionId && nodeType(arc.source) === 'place');
}

function outputArcs(transitionId) {
  return net.arcs.filter((arc) => arc.source === transitionId && nodeType(arc.target) === 'place');
}

function deleteSelection() {
  if (selection === null) {
    statusMessage = 'Nothing is selected.';
    return;
  }
  if (selection.type === 'arc') {
    net.arcs = net.arcs.filter((arc) => arc.id !== selection.id);
  } else {
    net.places = net.places.filter((place) => place.id !== selection.id);
    net.transitions = net.transitions.filter((transition) => transition.id !== selection.id);
    net.arcs = net.arcs.filter((arc) => arc.source !== selection.id && arc.target !== selection.id);
  }
  selection = null;
  statusMessage = 'Selection deleted.';
}

function exportJson() {
  const blob = new Blob([`${JSON.stringify(exportNet(), null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'petri-net.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function importSelectedFile(event) {
  const file = event.currentTarget.files?.[0];
  if (file === undefined) return;
  try {
    const imported = parseNet(JSON.parse(await file.text()));
    net = imported;
    selection = null;
    drawMode = false;
    arcSource = null;
    sequence = nextSequence();
    statusMessage = 'Net imported.';
    saveNet();
  } catch {
    statusMessage = 'Import rejected: invalid Petri net JSON.';
  }
  render();
}

function selectedItem() {
  if (selection === null) return null;
  if (selection.type === 'place') {
    const item = net.places.find((place) => place.id === selection.id);
    return item === undefined ? null : { type: 'place', item };
  }
  if (selection.type === 'transition') {
    const item = net.transitions.find((transition) => transition.id === selection.id);
    return item === undefined ? null : { type: 'transition', item };
  }
  const item = net.arcs.find((arc) => arc.id === selection.id);
  return item === undefined ? null : { type: 'arc', item };
}

function nodeById(id) {
  const item = [...net.places, ...net.transitions].find((node) => node.id === id);
  if (item === undefined) throw new Error(`Unknown node ${id}`);
  return item;
}

function nodeType(id) {
  if (net.places.some((place) => place.id === id)) return 'place';
  if (net.transitions.some((transition) => transition.id === id)) return 'transition';
  throw new Error(`Unknown node ${id}`);
}

function center(node) {
  return nodeType(node.id) === 'place'
    ? { x: node.x + 37, y: node.y + 37 }
    : { x: node.x + 17, y: node.y + 42 };
}

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/gu,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character],
  );
}

function record(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}
