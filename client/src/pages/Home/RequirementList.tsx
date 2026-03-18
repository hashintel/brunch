import { useState, useMemo } from 'preact/hooks';
import {
    createColumnHelper,
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import {
    DndContext,
    closestCenter,
    useSensors,
    useSensor,
    PointerSensor,
    KeyboardSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Requirement } from './types';

interface Props {
    requirements: Requirement[];
    onUpdate: (requirements: Requirement[]) => void;
}

const columnHelper = createColumnHelper<Requirement>();

function SortableCard({
    requirement,
    index,
    isEditing,
    editDraft,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onEditDraftChange,
    onRemove,
}: {
    requirement: Requirement;
    index: number;
    isEditing: boolean;
    editDraft: Requirement | null;
    onStartEdit: (i: number) => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    onEditDraftChange: (draft: Requirement) => void;
    onRemove: (i: number) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: String(index) });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div class="requirement" ref={setNodeRef} style={style} {...attributes}>
            {isEditing && editDraft ? (
                <div class="requirement-edit">
                    <input
                        class="requirement-edit-input"
                        value={editDraft.title}
                        onInput={e => onEditDraftChange({ ...editDraft, title: e.currentTarget.value })}
                        placeholder="Title"
                    />
                    <textarea
                        class="requirement-edit-textarea"
                        value={editDraft.definition}
                        onInput={e => onEditDraftChange({ ...editDraft, definition: e.currentTarget.value })}
                        placeholder="Definition"
                    />
                    <div class="requirement-edit-actions">
                        <button class="button button-small" onClick={onSaveEdit}>Save</button>
                        <button class="button button-small button-secondary" onClick={onCancelEdit}>Cancel</button>
                    </div>
                </div>
            ) : (
                <>
                    <div class="requirement-header">
                        <span class="drag-handle" title="Drag to reorder" {...listeners}>&#8942;</span>
                        <strong>{requirement.title}</strong>
                        <div class="requirement-actions">
                            <span class="requirement-confidence">{Math.round(requirement.confidence * 100)}%</span>
                            <button class="requirement-action" onClick={() => onStartEdit(index)} title="Edit">&#9998;</button>
                            <button class="requirement-action requirement-action-remove" onClick={() => onRemove(index)} title="Remove">&times;</button>
                        </div>
                    </div>
                    <p>{requirement.definition}</p>
                </>
            )}
        </div>
    );
}

function SortableTableRow({
    row,
    onStartEdit,
    onRemove,
    setView,
}: {
    row: any;
    onStartEdit: (i: number) => void;
    onRemove: (i: number) => void;
    setView: (v: 'list' | 'table') => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: row.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <tr ref={setNodeRef} style={style} {...attributes}>
            {row.getVisibleCells().map((cell: any) => {
                const columnId = cell.column.id;
                if (columnId === 'drag-handle') {
                    return (
                        <td key={cell.id} class="drag-handle" title="Drag to reorder" {...listeners}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                    );
                }
                if (columnId === 'actions') {
                    return (
                        <td key={cell.id} class="requirements-table-actions">
                            <button class="requirement-action" onClick={() => { setView('list'); onStartEdit(row.index); }} title="Edit">&#9998;</button>
                            <button class="requirement-action requirement-action-remove" onClick={() => onRemove(row.index)} title="Remove">&times;</button>
                        </td>
                    );
                }
                if (columnId === 'confidence') {
                    return (
                        <td key={cell.id} class="requirement-confidence">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                    );
                }
                return (
                    <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                );
            })}
        </tr>
    );
}

const columns = [
    columnHelper.display({
        id: 'drag-handle',
        header: '',
        cell: () => <span>&#8942;</span>,
    }),
    columnHelper.display({
        id: 'index',
        header: '#',
        cell: (info) => info.row.index + 1,
    }),
    columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => <strong>{info.getValue()}</strong>,
    }),
    columnHelper.accessor('definition', {
        header: 'Definition',
    }),
    columnHelper.accessor('confidence', {
        header: 'Confidence',
        cell: (info) => `${Math.round(info.getValue() * 100)}%`,
    }),
    columnHelper.display({
        id: 'actions',
        header: '',
        cell: () => null, // rendered manually in SortableTableRow
    }),
];

export function RequirementList({ requirements, onUpdate }: Props) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Requirement | null>(null);
    const [view, setView] = useState<'list' | 'table'>('list');
    const [adding, setAdding] = useState(false);
    const [addDraft, setAddDraft] = useState<Requirement>({ title: '', definition: '', confidence: 1 });

    const table = useReactTable({
        data: requirements,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (_, i) => String(i),
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const sortableItems = useMemo(
        () => requirements.map((_, i) => String(i)),
        [requirements],
    );

    function handleRemove(index: number) {
        onUpdate(requirements.filter((_, i) => i !== index));
    }

    function handleStartEdit(index: number) {
        setEditingIndex(index);
        setEditDraft({ ...requirements[index] });
    }

    function handleCancelEdit() {
        setEditingIndex(null);
        setEditDraft(null);
    }

    function handleSaveEdit() {
        if (editingIndex === null || !editDraft) return;
        onUpdate(requirements.map((r, i) => i === editingIndex ? editDraft : r));
        setEditingIndex(null);
        setEditDraft(null);
    }

    function handleStartAdd() {
        setAdding(true);
        setAddDraft({ title: '', definition: '', confidence: 1 });
    }

    function handleCancelAdd() {
        setAdding(false);
        setAddDraft({ title: '', definition: '', confidence: 1 });
    }

    function handleSaveAdd() {
        if (!addDraft.title.trim()) return;
        onUpdate([...requirements, addDraft]);
        setAdding(false);
        setAddDraft({ title: '', definition: '', confidence: 1 });
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = Number(active.id);
        const newIndex = Number(over.id);
        onUpdate(arrayMove(requirements, oldIndex, newIndex));
    }

    return (
        <div class="requirements">
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

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                    {view === 'table' ? (
                        <table class="requirements-table">
                            <thead>
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map(header => (
                                            <th key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map(row => (
                                    <SortableTableRow
                                        key={row.id}
                                        row={row}
                                        onStartEdit={handleStartEdit}
                                        onRemove={handleRemove}
                                        setView={setView}
                                    />
                                ))}
                                {adding ? (
                                    <tr>
                                        <td></td>
                                        <td>{requirements.length + 1}</td>
                                        <td>
                                            <input
                                                class="requirement-edit-input"
                                                value={addDraft.title}
                                                onInput={e => setAddDraft({ ...addDraft, title: e.currentTarget.value })}
                                                placeholder="Title"
                                                style="width:100%"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                class="requirement-edit-input"
                                                value={addDraft.definition}
                                                onInput={e => setAddDraft({ ...addDraft, definition: e.currentTarget.value })}
                                                placeholder="Definition"
                                                style="width:100%;font-weight:400"
                                            />
                                        </td>
                                        <td>100%</td>
                                        <td class="requirements-table-actions">
                                            <button class="requirement-action" onClick={handleSaveAdd} title="Save">&#10003;</button>
                                            <button class="requirement-action requirement-action-remove" onClick={handleCancelAdd} title="Cancel">&times;</button>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td colspan={6}>
                                            <button class="requirement-add-btn" onClick={handleStartAdd}>+ Add requirement</button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <>
                            {requirements.map((req, i) => (
                                <SortableCard
                                    key={i}
                                    requirement={req}
                                    index={i}
                                    isEditing={editingIndex === i}
                                    editDraft={editDraft}
                                    onStartEdit={handleStartEdit}
                                    onCancelEdit={handleCancelEdit}
                                    onSaveEdit={handleSaveEdit}
                                    onEditDraftChange={setEditDraft}
                                    onRemove={handleRemove}
                                />
                            ))}
                            {adding ? (
                                <div class="requirement">
                                    <div class="requirement-edit">
                                        <input
                                            class="requirement-edit-input"
                                            value={addDraft.title}
                                            onInput={e => setAddDraft({ ...addDraft, title: e.currentTarget.value })}
                                            placeholder="Title"
                                        />
                                        <textarea
                                            class="requirement-edit-textarea"
                                            value={addDraft.definition}
                                            onInput={e => setAddDraft({ ...addDraft, definition: e.currentTarget.value })}
                                            placeholder="Definition"
                                        />
                                        <div class="requirement-edit-actions">
                                            <button class="button button-small" onClick={handleSaveAdd}>Add</button>
                                            <button class="button button-small button-secondary" onClick={handleCancelAdd}>Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button class="requirement-add-btn" onClick={handleStartAdd}>+ Add requirement</button>
                            )}
                        </>
                    )}
                </SortableContext>
            </DndContext>
        </div>
    );
}
