import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import {
    DndContext,
    closestCenter,
    useSensors,
    useSensor,
    PointerSensor,
    KeyboardSensor,
    DragOverlay,
    MeasuringStrategy,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Requirement, TestCase, TestType } from './types';

interface Props {
    requirements: Requirement[];
    onUpdate: (requirements: Requirement[]) => void;
    onGenerateChildren: (id: string) => void;
    onGenerateTests: (id: string) => void;
    generatingChildrenId: string | null;
    generatingTestsId: string | null;
}

const STAGE_ORDER: Requirement['stage'][] = ['proposal', 'approved', 'completed'];
const STAGE_LABELS: Record<Requirement['stage'], string> = {
    proposal: 'Proposal',
    approved: 'Approved',
    completed: 'Completed',
};

const TEST_TYPE_LABELS: Record<TestType, string> = {
    static_analysis: 'Static Analysis',
    programmatic_test: 'Programmatic Test',
    llm_review: 'LLM Review',
    human_review: 'Human Review',
};

const TEST_TYPES: TestType[] = ['static_analysis', 'programmatic_test', 'llm_review', 'human_review'];

const NEST_THRESHOLD = 40;

function emptyRequirement(): Requirement {
    return { id: '', title: '', definition: '', confidence: 1, stage: 'proposal', tests: [], children: [] };
}

// ── Flatten / unflatten tree for DnD ──

type FlatItem = {
    id: string;
    req: Requirement;
    depth: number;
    parentId: string | null;
};

function flattenTree(requirements: Requirement[], depth = 0, parentId: string | null = null): FlatItem[] {
    const items: FlatItem[] = [];
    for (const r of requirements) {
        items.push({ id: r.id, req: r, depth, parentId });
        if (r.children.length > 0) {
            items.push(...flattenTree(r.children, depth + 1, r.id));
        }
    }
    return items;
}

// Recursive tree helpers
function findInTree(requirements: Requirement[], id: string): Requirement | null {
    for (const r of requirements) {
        if (r.id === id) return r;
        const found = findInTree(r.children, id);
        if (found) return found;
    }
    return null;
}

function removeFromTree(requirements: Requirement[], id: string): Requirement[] {
    return requirements
        .filter(r => r.id !== id)
        .map(r => ({ ...r, children: removeFromTree(r.children, id) }));
}

function updateInTree(requirements: Requirement[], id: string, updater: (r: Requirement) => Requirement): Requirement[] {
    return requirements.map(r => {
        if (r.id === id) return updater(r);
        return { ...r, children: updateInTree(r.children, id, updater) };
    });
}

function insertIntoTree(requirements: Requirement[], parentId: string, child: Requirement, afterChildId?: string): Requirement[] {
    return requirements.map(r => {
        if (r.id === parentId) {
            const children = [...r.children];
            if (afterChildId) {
                const idx = children.findIndex(c => c.id === afterChildId);
                children.splice(idx >= 0 ? idx + 1 : children.length, 0, child);
            } else {
                children.push(child);
            }
            return { ...r, children };
        }
        return { ...r, children: insertIntoTree(r.children, parentId, child, afterChildId) };
    });
}

function getProjectedDepth(
    flatItems: FlatItem[],
    activeId: string,
    overId: string,
    dragOffsetX: number,
): number {
    const overIndex = flatItems.findIndex(i => i.id === overId);
    if (overIndex < 0) return 0;
    const overDepth = flatItems[overIndex].depth;
    // Find the max depth we could nest at (one level deeper than the item above, excluding the dragged item)
    const itemAbove = overIndex > 0 ? flatItems[overIndex - 1] : null;
    const maxDepth = itemAbove && itemAbove.id !== activeId ? itemAbove.depth + 1 : overDepth + 1;

    if (dragOffsetX > NEST_THRESHOLD) {
        return Math.min(overDepth + 1, maxDepth);
    }
    if (dragOffsetX < -NEST_THRESHOLD) {
        return Math.max(0, overDepth - 1);
    }
    return overDepth;
}

// ── Edit Modal ──

function EditModal({
    draft,
    onChange,
    onSave,
    onCancel,
    title,
}: {
    draft: Requirement;
    onChange: (r: Requirement) => void;
    onSave: () => void;
    onCancel: () => void;
    title: string;
}) {
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel]);

    function handleAddTest() {
        onChange({ ...draft, tests: [...draft.tests, { type: 'programmatic_test', description: '' }] });
    }
    function handleUpdateTest(i: number, t: TestCase) {
        onChange({ ...draft, tests: draft.tests.map((x, j) => j === i ? t : x) });
    }
    function handleRemoveTest(i: number) {
        onChange({ ...draft, tests: draft.tests.filter((_, j) => j !== i) });
    }

    return (
        <div class="modal-backdrop" ref={backdropRef}
            onClick={e => { if (e.target === backdropRef.current) onCancel(); }}>
            <div class="modal">
                <div class="modal-header">
                    <strong>{title}</strong>
                    <button class="modal-close" onClick={onCancel}>&times;</button>
                </div>
                <div class="modal-body">
                    <label class="modal-label">Title</label>
                    <input class="modal-input" value={draft.title}
                        onInput={e => onChange({ ...draft, title: e.currentTarget.value })}
                        placeholder="Requirement title" />
                    <label class="modal-label">Definition</label>
                    <textarea class="modal-textarea" value={draft.definition}
                        onInput={e => onChange({ ...draft, definition: e.currentTarget.value })}
                        placeholder="What does this requirement entail?" rows={3} />
                    <div class="modal-row">
                        <div>
                            <label class="modal-label">Confidence</label>
                            <input class="modal-input modal-input--short" type="number"
                                min="0" max="1" step="0.05" value={draft.confidence}
                                onInput={e => onChange({ ...draft, confidence: parseFloat(e.currentTarget.value) || 0 })} />
                        </div>
                        <div>
                            <label class="modal-label">Stage</label>
                            <select class="modal-select" value={draft.stage}
                                onChange={e => onChange({ ...draft, stage: e.currentTarget.value as Requirement['stage'] })}>
                                {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                            </select>
                        </div>
                    </div>
                    <label class="modal-label">Tests / Verification</label>
                    <div class="modal-tests">
                        {draft.tests.map((t, i) => (
                            <div key={i} class="modal-test-row">
                                <select class="modal-select modal-select--test-type" value={t.type}
                                    onChange={e => handleUpdateTest(i, { ...t, type: e.currentTarget.value as TestType })}>
                                    {TEST_TYPES.map(tt => <option key={tt} value={tt}>{TEST_TYPE_LABELS[tt]}</option>)}
                                </select>
                                <textarea class="modal-textarea modal-textarea--test-desc" value={t.description}
                                    onInput={e => {
                                        handleUpdateTest(i, { ...t, description: e.currentTarget.value });
                                        e.currentTarget.style.height = 'auto';
                                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                    }}
                                    ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                    placeholder="Describe the test..." rows={1} />
                                <button class="modal-test-remove" onClick={() => handleRemoveTest(i)} title="Remove test">&times;</button>
                            </div>
                        ))}
                        <button class="requirement-add-btn" onClick={handleAddTest}>+ Add test</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="button button-small" onClick={onSave} disabled={!draft.title.trim()}>Save</button>
                    <button class="button button-small button-secondary" onClick={onCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

// ── Test entries (nested display with local toggle) ──

function TestEntries({ tests, visible, onToggle, compact }: { tests: TestCase[]; visible: boolean; onToggle: () => void; compact?: boolean }) {
    if (tests.length === 0) return null;
    return (
        <div class={`test-entries-wrapper ${compact ? 'test-entries-wrapper--compact' : ''}`}>
            <button class="test-toggle-btn" onClick={onToggle}>
                <span class={`test-toggle-chevron ${visible ? 'test-toggle-chevron--open' : ''}`}>&#9654;</span>
                {tests.length} test{tests.length !== 1 ? 's' : ''}
                {!visible && (
                    <span class="test-badges-inline">
                        {tests.map((t, i) => (
                            <span key={i} class={`test-badge test-badge--${t.type}`}>{TEST_TYPE_LABELS[t.type]}</span>
                        ))}
                    </span>
                )}
            </button>
            {visible && (
                <div class={`test-entries ${compact ? 'test-entries--compact' : ''}`}>
                    {tests.map((t, i) => (
                        <div key={i} class={`test-entry ${compact ? 'test-entry--compact' : ''}`}>
                            <span class={`test-entry-type test-entry-type--${t.type}`}>{TEST_TYPE_LABELS[t.type]}</span>
                            {t.description && <span class="test-entry-desc">{t.description}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Sortable card (list view DnD) ──

function SortableItem({
    item, onEdit, onRemove, onGenerateChildren, onGenerateTests, generatingChildrenId, generatingTestsId, testsVisible, onToggleTests, projectedDepth, isDragOverlay,
}: {
    item: FlatItem;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
    onGenerateChildren: (id: string) => void;
    onGenerateTests: (id: string) => void;
    generatingChildrenId: string | null;
    generatingTestsId: string | null;
    testsVisible: boolean;
    onToggleTests: (id: string) => void;
    projectedDepth?: number;
    isDragOverlay?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const depth = projectedDepth ?? item.depth;
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        marginLeft: `${depth * 1.5}rem`,
        ...(isDragOverlay ? { boxShadow: '0 4px 16px rgba(0,0,0,0.15)', cursor: 'grabbing' } : {}),
    };

    return (
        <div class={`requirement ${depth > 0 ? 'requirement-child' : ''}`}
            ref={isDragOverlay ? undefined : setNodeRef} style={style}
            {...(isDragOverlay ? {} : attributes)}>
            <div class="requirement-header">
                <span class="drag-handle" title="Drag to reorder or nest" {...(isDragOverlay ? {} : listeners)}>&#8942;</span>
                <strong>{item.req.title}</strong>
                <div class="requirement-actions">
                    <span class="requirement-confidence">{Math.round(item.req.confidence * 100)}%</span>
                    <span class={`requirement-stage requirement-stage--${item.req.stage}`}>{STAGE_LABELS[item.req.stage]}</span>
                    <button class="requirement-action" onClick={() => onEdit(item.id)} title="Edit">&#9998;</button>
                    <button class="requirement-action requirement-action-remove" onClick={() => onRemove(item.id)} title="Remove">&times;</button>
                </div>
            </div>
            <p>{item.req.definition}</p>
            <TestEntries tests={item.req.tests} visible={testsVisible} onToggle={() => onToggleTests(item.id)} />
            <div class="requirement-card-footer">
                <button class="requirement-expand-btn" onClick={() => onGenerateChildren(item.id)} disabled={generatingChildrenId === item.id}>
                    {generatingChildrenId === item.id ? 'Generating\u2026' : 'Generate Subrequirements'}
                </button>
                <button class="requirement-expand-btn" onClick={() => onGenerateTests(item.id)} disabled={generatingTestsId === item.id}>
                    {generatingTestsId === item.id ? 'Generating\u2026' : 'Generate Tests'}
                </button>
            </div>
        </div>
    );
}

// ── Sort header ──

type SortField = 'none' | 'confidence-asc' | 'confidence-desc' | 'stage-asc' | 'stage-desc' | 'title-asc' | 'title-desc';
type StageFilter = 'all' | Requirement['stage'];

function SortHeader({ label, field, current, onSort }: { label: string; field: string; current: SortField; onSort: (s: SortField) => void }) {
    const asc = `${field}-asc` as SortField;
    const desc = `${field}-desc` as SortField;
    const isAsc = current === asc;
    const isDesc = current === desc;
    return (
        <th class="sortable-th" onClick={() => isAsc ? onSort(desc) : isDesc ? onSort('none') : onSort(asc)}>
            {label}<span class="sort-indicator">{isAsc ? ' \u25B2' : isDesc ? ' \u25BC' : ''}</span>
        </th>
    );
}

function matchesSearch(item: FlatItem, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.req.title.toLowerCase().includes(q) || item.req.definition.toLowerCase().includes(q);
}

function matchesStage(item: FlatItem, filter: StageFilter): boolean {
    return filter === 'all' || item.req.stage === filter;
}

function compareFlatItems(a: FlatItem, b: FlatItem, sort: SortField): number {
    switch (sort) {
        case 'confidence-asc': return a.req.confidence - b.req.confidence;
        case 'confidence-desc': return b.req.confidence - a.req.confidence;
        case 'stage-asc': return STAGE_ORDER.indexOf(a.req.stage) - STAGE_ORDER.indexOf(b.req.stage);
        case 'stage-desc': return STAGE_ORDER.indexOf(b.req.stage) - STAGE_ORDER.indexOf(a.req.stage);
        case 'title-asc': return a.req.title.localeCompare(b.req.title);
        case 'title-desc': return b.req.title.localeCompare(a.req.title);
        default: return 0;
    }
}

// ── Canvas view ──

const CANVAS_NODE_W = 220;
const CANVAS_NODE_GAP_X = 40;
const CANVAS_NODE_GAP_Y = 60;
const CANVAS_NODE_H_EST = 90; // estimated height per node

type NodePos = { x: number; y: number };

function computeLayout(requirements: Requirement[]): Record<string, NodePos> {
    const pos: Record<string, NodePos> = {};

    // Compute the width needed for a subtree (leaf count * node slot width)
    function subtreeLeafCount(r: Requirement): number {
        if (r.children.length === 0) return 1;
        return r.children.reduce((sum, c) => sum + subtreeLeafCount(c), 0);
    }

    function layoutSubtree(reqs: Requirement[], startX: number, y: number) {
        let x = startX;
        for (const r of reqs) {
            const leafCount = subtreeLeafCount(r);
            const subtreeWidth = leafCount * (CANVAS_NODE_W + CANVAS_NODE_GAP_X);
            const parentX = x + (subtreeWidth - CANVAS_NODE_W) / 2;
            pos[r.id] = { x: parentX, y };
            if (r.children.length > 0) {
                layoutSubtree(r.children, x, y + CANVAS_NODE_H_EST + CANVAS_NODE_GAP_Y);
            }
            x += subtreeWidth;
        }
    }

    layoutSubtree(requirements, 30, 30);
    return pos;
}

function CanvasView({
    requirements, onEdit, onRemove, onGenerateChildren, onGenerateTests, generatingChildrenId, generatingTestsId, isTestsVisible, onToggleTests,
}: {
    requirements: Requirement[];
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
    onGenerateChildren: (id: string) => void;
    onGenerateTests: (id: string) => void;
    generatingChildrenId: string | null;
    generatingTestsId: string | null;
    isTestsVisible: (id: string) => boolean;
    onToggleTests: (id: string) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [positions, setPositions] = useState<Record<string, NodePos>>({});
    const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
    const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // Recompute layout when requirements change structurally (new ids appear)
    useEffect(() => {
        setPositions(prev => {
            const layout = computeLayout(requirements);
            const merged: Record<string, NodePos> = {};
            // Keep existing positions for nodes that already exist, use layout for new ones
            for (const id of Object.keys(layout)) {
                merged[id] = prev[id] ?? layout[id];
            }
            return merged;
        });
    }, [flattenTree(requirements).map(i => i.id).join('|')]);

    // Canvas dimensions
    const canvasSize = useMemo(() => {
        let maxX = 600, maxY = 400;
        for (const p of Object.values(positions)) {
            maxX = Math.max(maxX, p.x + CANVAS_NODE_W + 40);
            maxY = Math.max(maxY, p.y + CANVAS_NODE_H_EST + 40);
        }
        return { width: maxX, height: maxY };
    }, [positions]);

    // Edges: parent → child (recursive)
    const edges = useMemo(() => {
        const result: { from: string; to: string }[] = [];
        function collectEdges(reqs: Requirement[]) {
            for (const r of reqs) {
                for (const c of r.children) {
                    result.push({ from: r.id, to: c.id });
                }
                collectEdges(r.children);
            }
        }
        collectEdges(requirements);
        return result;
    }, [requirements]);

    function handlePointerDown(id: string, e: PointerEvent) {
        if ((e.target as HTMLElement).closest('.requirement-action, .requirement-expand-btn, .requirement-stage')) return;
        e.preventDefault();
        const pos = positions[id];
        if (!pos) return;
        setDragging({ id, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y });
    }

    useEffect(() => {
        if (!dragging) return;
        function onMove(e: PointerEvent) {
            if (!dragging) return;
            const dx = e.clientX - dragging.startX;
            const dy = e.clientY - dragging.startY;
            setPositions(prev => ({
                ...prev,
                [dragging.id]: { x: Math.max(0, dragging.origX + dx), y: Math.max(0, dragging.origY + dy) },
            }));
        }
        function onUp() { setDragging(null); }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [dragging]);

    const flatItems = flattenTree(requirements);

    return (
        <div class="canvas-container" ref={containerRef}>
            <div class="canvas" style={{ width: canvasSize.width + 'px', height: canvasSize.height + 'px' }}>
                <svg class="canvas-edges" width={canvasSize.width} height={canvasSize.height}>
                    {edges.map(edge => {
                        const from = positions[edge.from];
                        const to = positions[edge.to];
                        if (!from || !to) return null;
                        const fromNode = nodeRefs.current[edge.from];
                        const fromH = fromNode?.offsetHeight ?? CANVAS_NODE_H_EST;
                        const x1 = from.x + CANVAS_NODE_W / 2;
                        const y1 = from.y + fromH;
                        const x2 = to.x + CANVAS_NODE_W / 2;
                        const y2 = to.y;
                        const midY = (y1 + y2) / 2;
                        return (
                            <path
                                key={`${edge.from}-${edge.to}`}
                                d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
                                class="canvas-edge"
                            />
                        );
                    })}
                </svg>
                {flatItems.map(item => {
                    const pos = positions[item.id];
                    if (!pos) return null;
                    const isChild = item.depth > 0;
                    return (
                        <div
                            key={item.id}
                            ref={el => { nodeRefs.current[item.id] = el; }}
                            class={`canvas-node ${isChild ? 'canvas-node--child' : ''} ${dragging?.id === item.id ? 'canvas-node--dragging' : ''}`}
                            style={{ left: pos.x + 'px', top: pos.y + 'px', width: CANVAS_NODE_W + 'px' }}
                            onPointerDown={e => handlePointerDown(item.id, e)}
                        >
                            <div class="canvas-node-header">
                                <strong>{item.req.title}</strong>
                                <div class="canvas-node-actions">
                                    <button class="requirement-action" onClick={() => onEdit(item.id)} title="Edit">&#9998;</button>
                                    <button class="requirement-action requirement-action-remove" onClick={() => onRemove(item.id)} title="Remove">&times;</button>
                                </div>
                            </div>
                            <div class="canvas-node-meta">
                                <span class="requirement-confidence">{Math.round(item.req.confidence * 100)}%</span>
                                <span class={`requirement-stage requirement-stage--${item.req.stage}`}>{STAGE_LABELS[item.req.stage]}</span>
                            </div>
                            <p class="canvas-node-def">{item.req.definition}</p>
                            <TestEntries tests={item.req.tests} visible={isTestsVisible(item.id)} onToggle={() => onToggleTests(item.id)} compact />
                            <div class="canvas-node-actions-bottom">
                                <button class="requirement-expand-btn" onClick={() => onGenerateChildren(item.id)} disabled={generatingChildrenId === item.id}>
                                    {generatingChildrenId === item.id ? 'Generating\u2026' : 'Subreqs'}
                                </button>
                                <button class="requirement-expand-btn" onClick={() => onGenerateTests(item.id)} disabled={generatingTestsId === item.id}>
                                    {generatingTestsId === item.id ? 'Generating\u2026' : 'Tests'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main component ──

export function RequirementList({ requirements, onUpdate, onGenerateChildren, onGenerateTests, generatingChildrenId, generatingTestsId }: Props) {
    const [view, setView] = useState<'list' | 'table' | 'canvas'>('list');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortField>('none');
    const [stageFilter, setStageFilter] = useState<StageFilter>('all');
    const [showTestsGlobal, setShowTestsGlobal] = useState(false);
    const [testsExpandedIds, setTestsExpandedIds] = useState<Set<string>>(new Set());

    function isTestsVisible(id: string): boolean {
        if (testsExpandedIds.has(id)) return !showTestsGlobal; // locally overridden
        return showTestsGlobal;
    }

    function toggleTestsForId(id: string) {
        setTestsExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleTestsGlobal() {
        setShowTestsGlobal(prev => !prev);
        setTestsExpandedIds(new Set()); // reset local overrides
    }

    const [modal, setModal] = useState<{
        mode: 'edit' | 'add';
        draft: Requirement;
        editId?: string;
    } | null>(null);

    // DnD state (list view)
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const dragStartXRef = useRef(0);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const flatItems = useMemo(() => flattenTree(requirements), [requirements]);
    const flatIds = useMemo(() => flatItems.map(i => i.id), [flatItems]);

    const projectedDepth = useMemo(() => {
        if (!activeId || !overId) return null;
        return getProjectedDepth(flatItems, activeId, overId, dragOffsetX);
    }, [flatItems, activeId, overId, dragOffsetX]);

    function handleRemoveById(id: string) {
        onUpdate(removeFromTree(requirements, id));
    }

    function openEditById(id: string) {
        const req = findInTree(requirements, id);
        if (!req) return;
        setModal({ mode: 'edit', draft: { ...req }, editId: id });
    }

    function openAdd() {
        setModal({ mode: 'add', draft: emptyRequirement() });
    }

    function handleModalSave() {
        if (!modal || !modal.draft.title.trim()) return;
        if (modal.mode === 'edit' && modal.editId) {
            onUpdate(updateInTree(requirements, modal.editId, existing => ({
                ...modal.draft,
                children: existing.children, // preserve children structure
            })));
        } else if (modal.mode === 'add') {
            onUpdate([...requirements, { ...modal.draft, id: crypto.randomUUID() }]);
        }
        setModal(null);
    }

    // ── List DnD handlers ──
    function handleDragStart(event: DragStartEvent) {
        setActiveId(String(event.active.id));
        dragStartXRef.current = (event.activatorEvent as PointerEvent).clientX;
        setDragOffsetX(0);
    }
    function handleDragOver(event: DragOverEvent) {
        setOverId(event.over ? String(event.over.id) : null);
        setDragOffsetX(event.delta.x);
    }
    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveId(null); setOverId(null); setDragOffsetX(0);
        if (!over || active.id === over.id) return;
        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);
        const depth = getProjectedDepth(flatItems, activeIdStr, overIdStr, event.delta.x);

        // Extract the dragged requirement (with its children intact)
        const draggedReq = findInTree(requirements, activeIdStr);
        if (!draggedReq) return;
        let newReqs = removeFromTree(requirements, activeIdStr);

        const flatWithout = flattenTree(newReqs);
        const overIdx = flatWithout.findIndex(i => i.id === overIdStr);

        if (depth === 0) {
            // Insert as top-level
            let insertIdx: number;
            if (overIdx < 0) {
                insertIdx = newReqs.length;
            } else {
                // Find which top-level item the over target belongs to
                let topId = overIdStr;
                for (let i = overIdx; i >= 0; i--) {
                    if (flatWithout[i].depth === 0) { topId = flatWithout[i].id; break; }
                }
                const ti = newReqs.findIndex(r => r.id === topId);
                insertIdx = ti >= 0 ? ti + 1 : newReqs.length;
            }
            newReqs.splice(insertIdx, 0, { ...draggedReq });
        } else {
            // Find the parent at depth-1 by walking backwards from over position
            let parentId: string | null = null;
            if (overIdx >= 0) {
                for (let i = overIdx; i >= 0; i--) {
                    if (flatWithout[i].depth === depth - 1) { parentId = flatWithout[i].id; break; }
                }
            }
            if (parentId) {
                const overItem = flatWithout[overIdx];
                const afterChildId = overItem.parentId === parentId ? overItem.id : undefined;
                newReqs = insertIntoTree(newReqs, parentId, { ...draggedReq }, afterChildId);
            } else {
                newReqs.push({ ...draggedReq });
            }
        }
        onUpdate(newReqs);
    }
    function handleDragCancel() { setActiveId(null); setOverId(null); setDragOffsetX(0); }

    // ── Table data ──
    const displayRows = useMemo(() => {
        let items = flattenTree(requirements);
        if (search || stageFilter !== 'all') items = items.filter(i => matchesSearch(i, search) && matchesStage(i, stageFilter));
        if (sort !== 'none') items = [...items].sort((a, b) => compareFlatItems(a, b, sort));
        return items;
    }, [requirements, search, sort, stageFilter]);

    const hasActiveFilters = search !== '' || stageFilter !== 'all' || sort !== 'none';
    const modalTitle = modal?.mode === 'add' ? 'Add Requirement' : 'Edit Requirement';
    const activeItem = activeId ? flatItems.find(i => i.id === activeId) ?? null : null;

    return (
        <div class="requirements">
            {modal && (
                <EditModal title={modalTitle} draft={modal.draft}
                    onChange={draft => setModal({ ...modal, draft })}
                    onSave={handleModalSave} onCancel={() => setModal(null)} />
            )}

            <div class="requirements-toolbar">
                <div class="requirements-view-toggle">
                    <button class={`view-toggle-btn ${view === 'list' ? 'view-toggle-btn--active' : ''}`}
                        onClick={() => setView('list')}>List</button>
                    <button class={`view-toggle-btn ${view === 'table' ? 'view-toggle-btn--active' : ''}`}
                        onClick={() => setView('table')}>Table</button>
                    <button class={`view-toggle-btn ${view === 'canvas' ? 'view-toggle-btn--active' : ''}`}
                        onClick={() => setView('canvas')}>Canvas</button>
                </div>
                <button class={`tests-global-toggle ${showTestsGlobal ? 'tests-global-toggle--active' : ''}`}
                    onClick={toggleTestsGlobal} title={showTestsGlobal ? 'Hide all tests' : 'Show all tests'}>
                    {showTestsGlobal ? 'Hide Tests' : 'Show Tests'}
                </button>

                {view === 'table' && (
                    <div class="requirements-filters">
                        <input class="filter-search" type="text" placeholder="Search..."
                            value={search} onInput={e => setSearch(e.currentTarget.value)} />
                        <select class="filter-select" value={stageFilter}
                            onChange={e => setStageFilter(e.currentTarget.value as StageFilter)}>
                            <option value="all">All stages</option>
                            {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                        </select>
                        {hasActiveFilters && (
                            <button class="filter-clear"
                                onClick={() => { setSearch(''); setStageFilter('all'); setSort('none'); }}
                                title="Clear filters">Clear</button>
                        )}
                    </div>
                )}
            </div>

            {view === 'table' ? (
                <table class="requirements-table">
                    <thead>
                        <tr>
                            <th style="width:1.5rem"></th>
                            <SortHeader label="Title" field="title" current={sort} onSort={setSort} />
                            <th>Definition</th>
                            <SortHeader label="Confidence" field="confidence" current={sort} onSort={setSort} />
                            <SortHeader label="Stage" field="stage" current={sort} onSort={setSort} />
                            <th>Tests</th>
                            <th style="width:5rem"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.length === 0 && (
                            <tr><td colspan={7} class="table-empty">No requirements match your filters.</td></tr>
                        )}
                        {displayRows.map(item => {
                            const isChild = item.depth > 0;
                            return (
                                <tr key={item.id} class={isChild ? 'table-row--child' : ''}>
                                    <td class="table-indent-cell" style={isChild ? { paddingLeft: `${item.depth * 1}rem` } : undefined}>
                                        {isChild ? <span class="table-indent-marker">&#8627;</span> : null}
                                    </td>
                                    <td><strong>{item.req.title}</strong></td>
                                    <td>{item.req.definition}</td>
                                    <td class="requirement-confidence">{Math.round(item.req.confidence * 100)}%</td>
                                    <td><span class={`requirement-stage requirement-stage--${item.req.stage}`}>{STAGE_LABELS[item.req.stage]}</span></td>
                                    <td>
                                        {item.req.tests.length > 0
                                            ? <TestEntries tests={item.req.tests} visible={isTestsVisible(item.id)} onToggle={() => toggleTestsForId(item.id)} compact />
                                            : <span class="test-count test-count--none">--</span>}
                                    </td>
                                    <td class="requirements-table-actions">
                                        <button class="requirement-action" onClick={() => openEditById(item.id)} title="Edit">&#9998;</button>
                                        <button class="requirement-action" onClick={() => onGenerateChildren(item.id)}
                                            disabled={generatingChildrenId === item.id} title="Generate Subrequirements">&#8690;</button>
                                        <button class="requirement-action" onClick={() => onGenerateTests(item.id)}
                                            disabled={generatingTestsId === item.id} title="Generate Tests">&#9881;</button>
                                        <button class="requirement-action requirement-action-remove"
                                            onClick={() => handleRemoveById(item.id)} title="Remove">&times;</button>
                                    </td>
                                </tr>
                            );
                        })}
                        <tr><td colspan={7}><button class="requirement-add-btn" onClick={openAdd}>+ Add requirement</button></td></tr>
                    </tbody>
                </table>
            ) : view === 'canvas' ? (
                <>
                    <CanvasView
                        requirements={requirements}
                        onEdit={openEditById}
                        onRemove={handleRemoveById}
                        onGenerateChildren={onGenerateChildren}
                        onGenerateTests={onGenerateTests}
                        generatingChildrenId={generatingChildrenId}
                        generatingTestsId={generatingTestsId}
                        isTestsVisible={isTestsVisible}
                        onToggleTests={toggleTestsForId}
                    />
                    <button class="requirement-add-btn" onClick={openAdd}>+ Add requirement</button>
                </>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter}
                    onDragStart={handleDragStart} onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}
                    measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>
                    <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
                        {flatItems.map(item => (
                            <SortableItem key={item.id} item={item}
                                onEdit={openEditById} onRemove={handleRemoveById}
                                onGenerateChildren={onGenerateChildren} onGenerateTests={onGenerateTests}
                                generatingChildrenId={generatingChildrenId} generatingTestsId={generatingTestsId}
                                testsVisible={isTestsVisible(item.id)} onToggleTests={toggleTestsForId}
                                projectedDepth={
                                    activeId && overId && item.id !== activeId ? undefined
                                    : item.id === activeId && projectedDepth != null ? projectedDepth
                                    : undefined
                                } />
                        ))}
                    </SortableContext>
                    <DragOverlay dropAnimation={null}>
                        {activeItem && (
                            <SortableItem item={activeItem} onEdit={() => {}} onRemove={() => {}}
                                onGenerateChildren={() => {}} onGenerateTests={() => {}}
                                generatingChildrenId={null} generatingTestsId={null}
                                testsVisible={isTestsVisible(activeItem.id)} onToggleTests={() => {}}
                                projectedDepth={projectedDepth ?? activeItem.depth} isDragOverlay />
                        )}
                    </DragOverlay>
                    <button class="requirement-add-btn" onClick={openAdd}>+ Add requirement</button>
                </DndContext>
            )}
        </div>
    );
}
