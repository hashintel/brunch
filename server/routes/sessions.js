import { Router } from 'express';
import db from '../db.js';

const router = Router();

function insertRequirements(projectPk, requirements, parentPk = null) {
    const stmt = db.prepare(`INSERT INTO entry (title, description, test, stage, confidence, project_id, parent_id, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (let i = 0; i < requirements.length; i++) {
        const r = requirements[i];
        const info = stmt.run(r.title, r.definition, JSON.stringify(r.tests ?? []), r.stage ?? 'proposal', r.confidence, projectPk, parentPk, i);
        if (r.children?.length > 0) {
            insertRequirements(projectPk, r.children, info.lastInsertRowid);
        }
    }
}

function buildRequirementTree(entries) {
    const byParent = new Map();
    for (const e of entries) {
        const pid = e.parent_id ?? null;
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(e);
    }
    for (const [, group] of byParent) group.sort((a, b) => a.sort_order - b.sort_order);

    function buildLevel(parentPk) {
        const children = byParent.get(parentPk) ?? [];
        return children.map(e => ({
            id: String(e.pk),
            title: e.title,
            definition: e.description,
            confidence: e.confidence,
            stage: e.stage,
            tests: JSON.parse(e.test || '[]'),
            children: buildLevel(e.pk),
        }));
    }
    return buildLevel(null);
}

function serializeSession(pk) {
    const project = db.prepare('SELECT * FROM project WHERE pk = ?').get(pk);
    if (!project) return null;
    const entries = db.prepare('SELECT * FROM entry WHERE project_id = ?').all(pk);
    const clarifyingState = JSON.parse(project.clarifying_state || '{}');
    return {
        id: String(project.pk), name: project.name,
        prompt: project.prompt, cwd: project.folder, response: project.goal,
        selectedModel: project.model, requirements: buildRequirementTree(entries),
        ...clarifyingState,
        createdAt: project.created_at, updatedAt: project.updated_at,
    };
}

router.get('/sessions', (_req, res) => {
    try {
        const rows = db.prepare('SELECT pk, name, updated_at FROM project ORDER BY updated_at DESC').all();
        res.json(rows.map(r => ({ id: String(r.pk), name: r.name, updatedAt: r.updated_at })));
    } catch (err) {
        console.error('[sessions] list error:', err.message);
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});

router.get('/sessions/:id', (req, res) => {
    const { id } = req.params;
    try {
        const session = serializeSession(id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (err) {
        console.error('[sessions] get error:', err.message);
        res.status(500).json({ error: 'Failed to load session' });
    }
});

router.post('/sessions', (req, res) => {
    const { name, prompt, cwd, response, selectedModel, requirements, ...clarifying } = req.body;
    try {
        const info = db.prepare(
            `INSERT INTO project (name, prompt, folder, goal, model, clarifying_state) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(name, prompt, cwd, response, selectedModel, JSON.stringify(clarifying));
        const pk = info.lastInsertRowid;
        insertRequirements(pk, requirements ?? []);
        res.status(201).json(serializeSession(pk));
    } catch (err) {
        console.error('[sessions] create error:', err.message);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

router.put('/sessions/:id', (req, res) => {
    const { id } = req.params;
    const { name, prompt, cwd, response, selectedModel, requirements, ...clarifying } = req.body;
    try {
        const existing = db.prepare('SELECT pk FROM project WHERE pk = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'Session not found' });
        db.prepare(
            `UPDATE project SET name=?, prompt=?, folder=?, goal=?, model=?, clarifying_state=?, updated_at=datetime('now') WHERE pk=?`
        ).run(name, prompt, cwd, response, selectedModel, JSON.stringify(clarifying), id);
        db.prepare('DELETE FROM entry WHERE project_id = ?').run(id);
        insertRequirements(Number(id), requirements ?? []);
        res.json(serializeSession(id));
    } catch (err) {
        console.error('[sessions] update error:', err.message);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

router.delete('/sessions/:id', (req, res) => {
    const { id } = req.params;
    try {
        const existing = db.prepare('SELECT pk FROM project WHERE pk = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'Session not found' });
        const deleteProject = db.transaction((pk) => {
            db.prepare('DELETE FROM entry WHERE project_id = ?').run(pk);
            db.prepare('DELETE FROM claude_call WHERE project_id = ?').run(pk);
            db.prepare('DELETE FROM project WHERE pk = ?').run(pk);
        });
        deleteProject(id);
        res.json({ ok: true });
    } catch (err) {
        console.error('[sessions] delete error:', err.message);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

export default router;
