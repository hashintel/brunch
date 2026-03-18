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
    onExpand: (id: string) => void;
    expandingId: string | null;
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

const NEST_THRESHOLD = 40; // px of horizontal drag to trigger nesting

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

function flattenTree(requirements: Requirement[]): FlatItem[] {
    const items: FlatItem[] = [];
    for (const r of requirements) {
        items.push({ id: r.id, req: r, depth: 0, parentId: null });
        for (const c of r.children) {
            items.push({ id: c.id, req: c, depth: 1, parentId: r.id });
        }
    }
    return items;
}

function unflattenTree(items: FlatItem[]): Requirement[] {
    const roots: Requirement[] = [];
    let currentParent: Requirement | null = null;

    for (const item of items) {
        const req: Requirement = { ...item.req, children: [] };
        if (item.depth === 0) {
            currentParent = req;
            roots.push(req);
        } else {
            // depth > 0: attach to most recent root
            if (currentParent) {
                currentParent.children.push(req);
            } else {
                // Orphan child — promote to root
                roots.push({ ...req, children: [] });
            }
        }
    }
    return roots;
}

/** Given a flat list and a drag operation, compute the projected depth (0 or 1) for the active item. */
function getProjectedDepth(
    flatItems: FlatItem[],
    activeId: string,
    overId: string,
    dragOffsetX: number,
): number {
    const overIndex = flatItems.findIndex(i => i.id === overId);
    if (overIndex < 0) return 0;

    // The item above the drop position
    const itemAbove = overIndex > 0 ? flatItems[overIndex - 1] : null;

    // If dragging right enough past threshold, try to nest
    if (dragOffsetX > NEST_THRESHOLD) {
        // Can only nest under a depth-0 item
        // The item at overIndex or above must be depth 0 for us to go to depth 1
        if (flatItems[overIndex].depth === 0 && flatItems[overIndex].id !== activeId) return 1;
        if (itemAbove && itemAbove.depth === 0 && itemAbove.id !== activeId) return 1;
    }

    // If dragging left, promote to root
    if (dragOffsetX < -NEST_THRESHOLD) return 0;

    // Default: match the depth of the over item
    return flatItems[overIndex].depth;
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
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onCancel();
        }
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
        <div
            class="modal-backdrop"
            ref={backdropRef}
            onClick={e => { if (e.target === backdropRef.current) onCancel(); }}
        >
            <div class="modal">
                <div class="modal-header">
                    <strong>{title}</strong>
                    <button class="modal-close" onClick={onCancel}>&times;</button>
                </div>
                <div class="modal-body">
                    <label class="modal-label">Title</label>
                    <input
                        class="modal-input"
                        value={draft.title}
                        onInput={e => onChange({ ...draft, title: e.currentTarget.value })}
                        placeholder="Requirement title"
                    />

                    <label class="modal-label">Definition</label>
                    <textarea
                        class="modal-textarea"
                        value={draft.definition}
                        onInput={e => onChange({ ...draft, definition: e.currentTarget.value })}
                        placeholder="What does this requirement entail?"
                        rows={3}
                    />

                    <div class="modal-row">
                        <div>
                            <label class="modal-label">Confidence</label>
                            <input
                                class="modal-input modal-input--short"
                                type="number"
                                min="0"
                                max="1"
                                step="0.05"
                                value={draft.confidence}
                                onInput={e => onChange({ ...draft, confidence: parseFloat(e.currentTarget.value) || 0 })}
                            />
                        </div>
                        <div>
                            <label class="modal-label">Stage</label>
                            <select
                                class="modal-select"
                                value={draft.stage}
                                onChange={e => onChange({ ...draft, stage: e.currentTarget.value as Requirement['stage'] })}
                            >
                                {STAGE_ORDER.map(s => (
                                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <label class="modal-label">Tests / Verification</label>
                    <div class="modal-tests">
                        {draft.tests.map((t, i) => (
                            <div key={i} class="modal-test-row">
                                <select
                                    class="modal-select modal-select--test-type"
                                    value={t.type}
                                    onChange={e => handleUpdateTest(i, { ...t, type: e.currentTarget.value as TestType })}
                                >
                                    {TEST_TYPES.map(tt => (
                                        <option key={tt} value={tt}>{TEST_TYPE_LABELS[tt]}</option>
                                    ))}
                                </select>
                                <input
                                    class="modal-input modal-input--test-desc"
                                    value={t.description}
                                    onInput={e => handleUpdateTest(i, { ...t, description: e.currentTarget.value })}
                                    placeholder="Describe the test..."
                                />
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

// ── Test badges ──

function TestBadges({ tests }: { tests: TestCase[] }) {
    if (tests.length === 0) return null;
    return (
        <div class="requirement-tests">
            {tests.map((t, i) => (
                <span key={i} class={`test-badge test-badge--${t.type}`} title={t.description || TEST_TYPE_LABELS[t.type]}>
                    {TEST_TYPE_LABELS[t.type]}
                </span>
            ))}
        </div>
    );
}

// ── Sortable card (used in flat DnD list) ──

function SortableItem({
    item,
    onEdit,
    onRemove,
    onExpand,
    expandingId,
    projectedDepth,
    isDragOverlay,
}: {
    item: FlatItem;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
    onExpand: (id: string) => void;
    expandingId: string | null;
    projectedDepth?: number;
    isDragOverlay?: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const depth = projectedDepth ?? item.depth;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        marginLeft: `${depth * 1.5}rem`,
        ...(isDragOverlay ? { boxShadow: '0 4px 16px rgba(0,0,0,0.15)', cursor: 'grabbing' } : {}),
    };

    return (
        <div
            class={`requirement ${depth > 0 ? 'requirement-child' : ''}`}
            ref={isDragOverlay ? undefined : setNodeRef}
            style={style}
            {...(isDragOverlay ? {} : attributes)}
        >
            <div class="requirement-header">
                <span class="drag-handle" title="Drag to reorder or nest" {...(isDragOverlay ? {} : listeners)}>&#8942;</span>
                <strong>{item.req.title}</strong>
                <div class="requirement-actions">
                    <span class="requirement-confidence">{Math.round(item.req.confidence * 100)}%</span>
                    <span class={`requirement-stage requirement-stage--${item.req.stage}`}>
                        {STAGE_LABELS[item.req.stage]}
                    </span>
                    <button class="requirement-action" onClick={() => onEdit(item.id)} title="Edit">&#9998;</button>
                    <button class="requirement-action requirement-action-remove" onClick={() => onRemove(item.id)} title="Remove">&times;</button>
                </div>
            </div>
            <p>{item.req.definition}</p>
            <TestBadges tests={item.req.tests} />
            <div class="requirement-card-footer">
                <button
                    class="requirement-expand-btn"
                    onClick={() => onExpand(item.id)}
                    disabled={expandingId === item.id}
                >
                    {expandingId === item.id ? 'Expanding\u2026' : 'Expand'}
                </button>
            </div>
        </div>
    );
}

// ── Sort header helper ──

function SortHeader({ label, field, current, onSort }: {
    label: string;
    field: string;
    current: SortField;
    onSort: (s: SortField) => void;
}) {
    const asc = `${field}-asc` as SortField;
    const desc = `${field}-desc` as SortField;
    const isAsc = current === asc;
    const isDesc = current === desc;

    function handleClick() {
        if (isAsc) onSort(desc);
        else if (isDesc) onSort('none');
        else onSort(asc);
    }

    return (
        <th class="sortable-th" onClick={handleClick}>
            {label}
            <span class="sort-indicator">
                {isAsc ? ' \u25B2' : isDesc ? ' \u25BC' : ''}
            </span>
        </th>
    );
}

// ── Table helpers ──

type SortField = 'none' | 'confidence-asc' | 'confidence-desc' | 'stage-asc' | 'stage-desc' | 'title-asc' | 'title-desc';
type StageFilter = 'all' | Requirement['stage'];

function matchesSearch(item: FlatItem, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.req.title.toLowerCase().includes(q) || item.req.definition.toLowerCase().includes(q);
}

function matchesStage(item: FlatItem, filter: StageFilter): boolean {
    if (filter === 'all') return true;
    return item.req.stage === filter;
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

// ── Main component ──

export function RequirementList({ requirements, onUpdate, onExpand, expandingId }: Props) {
    const [view, setView] = useState<'list' | 'table'>('list');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortField>('none');
    const [stageFilter, setStageFilter] = useState<StageFilter>('all');

    // Modal state
    const [modal, setModal] = useState<{
        mode: 'edit' | 'add';
        draft: Requirement;
        editId?: string;
    } | null>(null);

    // DnD state
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

    // Projected depth for the active item during drag
    const projectedDepth = useMemo(() => {
        if (!activeId || !overId) return null;
        return getProjectedDepth(flatItems, activeId, overId, dragOffsetX);
    }, [flatItems, activeId, overId, dragOffsetX]);

    // ── Helpers to find items by id ──

    function findReqById(id: string): { req: Requirement; parentIndex: number | null; childIndex: number | null; topIndex: number } | null {
        for (let i = 0; i < requirements.length; i++) {
            if (requirements[i].id === id) return { req: requirements[i], parentIndex: null, childIndex: null, topIndex: i };
            for (let ci = 0; ci < requirements[i].children.length; ci++) {
                if (requirements[i].children[ci].id === id) return { req: requirements[i].children[ci], parentIndex: i, childIndex: ci, topIndex: i };
            }
        }
        return null;
    }

    // ── Handlers ──

    function handleRemoveById(id: string) {
        const info = findReqById(id);
        if (!info) return;
        if (info.parentIndex != null && info.childIndex != null) {
            onUpdate(requirements.map((r, i) =>
                i === info.parentIndex ? { ...r, children: r.children.filter((_, ci) => ci !== info.childIndex) } : r
            ));
        } else {
            onUpdate(requirements.filter(r => r.id !== id));
        }
    }

    function openEditById(id: string) {
        const info = findReqById(id);
        if (!info) return;
        setModal({ mode: 'edit', draft: { ...info.req, children: info.parentIndex == null ? [...info.req.children] : [] }, editId: id });
    }

    function openAdd() {
        setModal({ mode: 'add', draft: emptyRequirement() });
    }

    function handleModalSave() {
        if (!modal || !modal.draft.title.trim()) return;
        if (modal.mode === 'edit' && modal.editId) {
            const info = findReqById(modal.editId);
            if (!info) return;
            if (info.parentIndex != null && info.childIndex != null) {
                // Editing a child
                onUpdate(requirements.map((r, i) =>
                    i === info.parentIndex
                        ? { ...r, children: r.children.map((c, ci) => ci === info.childIndex ? { ...modal.draft } : c) }
                        : r
                ));
            } else {
                // Editing a top-level: preserve children
                onUpdate(requirements.map(r => r.id === modal.editId ? { ...modal.draft, children: r.children } : r));
            }
        } else if (modal.mode === 'add') {
            onUpdate([...requirements, { ...modal.draft, id: crypto.randomUUID() }]);
        }
        setModal(null);
    }

    // ── DnD handlers ──

    function handleDragStart(event: DragStartEvent) {
        setActiveId(String(event.active.id));
        const pointerEvent = event.activatorEvent as PointerEvent;
        dragStartXRef.current = pointerEvent.clientX;
        setDragOffsetX(0);
    }

    function handleDragOver(event: DragOverEvent) {
        const { over, delta } = event;
        setOverId(over ? String(over.id) : null);
        setDragOffsetX(delta.x);
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);
        setDragOffsetX(0);

        if (!over || active.id === over.id) return;

        const activeIdStr = String(active.id);
        const overIdStr = String(over.id);
        const depth = getProjectedDepth(flatItems, activeIdStr, overIdStr, event.delta.x);

        // Remove the active item from the tree (extract it)
        let draggedReq: Requirement | null = null;
        let newReqs = requirements.map(r => {
            if (r.id === activeIdStr) {
                draggedReq = { ...r };
                return null; // mark for removal
            }
            const childIdx = r.children.findIndex(c => c.id === activeIdStr);
            if (childIdx >= 0) {
                draggedReq = { ...r.children[childIdx] };
                return { ...r, children: r.children.filter((_, i) => i !== childIdx) };
            }
            return r;
        }).filter(Boolean) as Requirement[];

        if (!draggedReq) return;

        // If dragged item was a parent, keep its children
        // (they travel with it)

        // Re-flatten without the dragged item to find insertion point
        const flatWithout = flattenTree(newReqs);
        const overIdx = flatWithout.findIndex(i => i.id === overIdStr);

        if (depth === 0) {
            // Insert as top-level at the position of 'over'
            // Find which top-level index 'over' corresponds to
            let insertIdx: number;
            if (overIdx < 0) {
                insertIdx = newReqs.length;
            } else {
                const overItem = flatWithout[overIdx];
                if (overItem.parentId) {
                    // over is a child — insert after its parent
                    const parentIdx = newReqs.findIndex(r => r.id === overItem.parentId);
                    insertIdx = parentIdx >= 0 ? parentIdx + 1 : newReqs.length;
                } else {
                    const topIdx = newReqs.findIndex(r => r.id === overItem.id);
                    insertIdx = topIdx >= 0 ? topIdx : newReqs.length;
                }
            }
            newReqs.splice(insertIdx, 0, draggedReq);
        } else {
            // Insert as child (depth 1)
            // Find the parent: it's the nearest depth-0 item at or above overIdx
            let parentId: string | null = null;
            if (overIdx >= 0) {
                // Walk backwards from overIdx to find a root
                for (let i = overIdx; i >= 0; i--) {
                    if (flatWithout[i].depth === 0) {
                        parentId = flatWithout[i].id;
                        break;
                    }
                }
            }

            if (parentId) {
                // Find child insertion index
                const parent = newReqs.find(r => r.id === parentId)!;
                const overItem = flatWithout[overIdx];
                let childInsertIdx: number;
                if (overItem.parentId === parentId) {
                    // over is already a child of this parent
                    childInsertIdx = parent.children.findIndex(c => c.id === overItem.id);
                    if (childInsertIdx < 0) childInsertIdx = parent.children.length;
                } else {
                    // over is the parent itself — append at end
                    childInsertIdx = parent.children.length;
                }
                // Strip children if nesting (children can't have children for MVP 2 levels)
                const nested: Requirement = { ...draggedReq, children: [] };
                parent.children.splice(childInsertIdx, 0, nested);
                // If dragged item had children, promote them to top-level after the parent
                if (draggedReq.children.length > 0) {
                    const parentTopIdx = newReqs.findIndex(r => r.id === parentId);
                    const promoted = draggedReq.children.map(c => ({ ...c, children: [] }));
                    newReqs.splice(parentTopIdx + 1, 0, ...promoted);
                }
            } else {
                // Fallback: insert as top-level
                newReqs.push(draggedReq);
            }
        }

        onUpdate(newReqs);
    }

    function handleDragCancel() {
        setActiveId(null);
        setOverId(null);
        setDragOffsetX(0);
    }

    // ── Table view data ──
    const displayRows = useMemo(() => {
        let items = flattenTree(requirements);
        if (search || stageFilter !== 'all') {
            items = items.filter(i => matchesSearch(i, search) && matchesStage(i, stageFilter));
        }
        if (sort !== 'none') {
            items = [...items].sort((a, b) => compareFlatItems(a, b, sort));
        }
        return items;
    }, [requirements, search, sort, stageFilter]);

    const hasActiveFilters = search !== '' || stageFilter !== 'all' || sort !== 'none';

    const modalTitle = modal?.mode === 'add' ? 'Add Requirement' : 'Edit Requirement';

    const activeItem = activeId ? flatItems.find(i => i.id === activeId) ?? null : null;

    return (
        <div class="requirements">
            {modal && (
                <EditModal
                    title={modalTitle}
                    draft={modal.draft}
                    onChange={draft => setModal({ ...modal, draft })}
                    onSave={handleModalSave}
                    onCancel={() => setModal(null)}
                />
            )}

            <div class="requirements-toolbar">
                <div class="requirements-view-toggle">
                    <button
                        class={`view-toggle-btn ${view === 'list' ? 'view-toggle-btn--active' : ''}`}
                        onClick={() => setView('list')}
                    >List</button>
                    <button
                        class={`view-toggle-btn ${view === 'table' ? 'view-toggle-btn--active' : ''}`}
                        onClick={() => setView('table')}
                    >Table</button>
                </div>

                {view === 'table' && (
                    <div class="requirements-filters">
                        <input
                            class="filter-search"
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onInput={e => setSearch(e.currentTarget.value)}
                        />
                        <select
                            class="filter-select"
                            value={stageFilter}
                            onChange={e => setStageFilter(e.currentTarget.value as StageFilter)}
                        >
                            <option value="all">All stages</option>
                            {STAGE_ORDER.map(s => (
                                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                            ))}
                        </select>
                        {hasActiveFilters && (
                            <button
                                class="filter-clear"
                                onClick={() => { setSearch(''); setStageFilter('all'); setSort('none'); }}
                                title="Clear filters"
                            >Clear</button>
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
                            <tr>
                                <td colspan={7} class="table-empty">No requirements match your filters.</td>
                            </tr>
                        )}
                        {displayRows.map(item => {
                            const isChild = item.depth > 0;
                            return (
                                <tr key={item.id} class={isChild ? 'table-row--child' : ''}>
                                    <td class="table-indent-cell">
                                        {isChild ? <span class="table-indent-marker">&#8627;</span> : null}
                                    </td>
                                    <td><strong>{item.req.title}</strong></td>
                                    <td>{item.req.definition}</td>
                                    <td class="requirement-confidence">{Math.round(item.req.confidence * 100)}%</td>
                                    <td>
                                        <span class={`requirement-stage requirement-stage--${item.req.stage}`}>
                                            {STAGE_LABELS[item.req.stage]}
                                        </span>
                                    </td>
                                    <td>
                                        {item.req.tests.length > 0
                                            ? <span class="test-count">{item.req.tests.length}</span>
                                            : <span class="test-count test-count--none">0</span>
                                        }
                                    </td>
                                    <td class="requirements-table-actions">
                                        <button class="requirement-action" onClick={() => openEditById(item.id)} title="Edit">&#9998;</button>
                                        {!isChild && (
                                            <button
                                                class="requirement-action"
                                                onClick={() => onExpand(item.id)}
                                                disabled={expandingId === item.id}
                                                title="Expand"
                                            >&#8690;</button>
                                        )}
                                        <button
                                            class="requirement-action requirement-action-remove"
                                            onClick={() => handleRemoveById(item.id)}
                                            title="Remove"
                                        >&times;</button>
                                    </td>
                                </tr>
                            );
                        })}
                        <tr>
                            <td colspan={7}>
                                <button class="requirement-add-btn" onClick={openAdd}>+ Add requirement</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                    measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                >
                    <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
                        {flatItems.map(item => (
                            <SortableItem
                                key={item.id}
                                item={item}
                                onEdit={openEditById}
                                onRemove={handleRemoveById}
                                onExpand={onExpand}
                                expandingId={expandingId}
                                projectedDepth={
                                    activeId && overId && item.id !== activeId
                                        ? undefined // non-dragged items keep their depth
                                        : item.id === activeId && projectedDepth != null
                                        ? projectedDepth
                                        : undefined
                                }
                            />
                        ))}
                    </SortableContext>
                    <DragOverlay dropAnimation={null}>
                        {activeItem && (
                            <SortableItem
                                item={activeItem}
                                onEdit={() => {}}
                                onRemove={() => {}}
                                onExpand={() => {}}
                                expandingId={null}
                                projectedDepth={projectedDepth ?? activeItem.depth}
                                isDragOverlay
                            />
                        )}
                    </DragOverlay>
                    <button class="requirement-add-btn" onClick={openAdd}>+ Add requirement</button>
                </DndContext>
            )}
        </div>
    );
}
