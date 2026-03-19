import { Router } from 'express';
import pool from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

async function insertRequirements(conn, projectPk, requirements, parentPk = null) {
    const sql = `INSERT INTO entry (title, description, test, stage, confidence, project_id, parent_id, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    for (let i = 0; i < requirements.length; i++) {
        const r = requirements[i];
        const [result] = await conn.execute(sql, [
            r.title, r.definition, JSON.stringify(r.tests ?? []),
            r.stage ?? 'proposal', r.confidence, projectPk, parentPk, i,
        ]);
        if (r.children?.length > 0) {
            await insertRequirements(conn, projectPk, r.children, result.insertId);
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

async function serializeSession(pk) {
    const [projects] = await pool.execute('SELECT * FROM project WHERE pk = ?', [pk]);
    const project = projects[0];
    if (!project) return null;
    const [entries] = await pool.execute('SELECT * FROM entry WHERE project_id = ?', [pk]);
    const clarifyingState = JSON.parse(project.clarifying_state || '{}');
    return {
        id: String(project.pk), name: project.name,
        prompt: project.prompt, cwd: project.folder, response: project.goal,
        selectedModel: project.model, requirements: buildRequirementTree(entries),
        ...clarifyingState,
        createdAt: project.created_at, updatedAt: project.updated_at,
    };
}

router.get('/sessions', asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute('SELECT pk, name, updated_at FROM project ORDER BY updated_at DESC');
    res.json(rows.map(r => ({ id: String(r.pk), name: r.name, updatedAt: r.updated_at })));
}));

router.get('/sessions/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const session = await serializeSession(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
}));

router.post('/sessions', asyncHandler(async (req, res) => {
    const { name, prompt, cwd, response, selectedModel, requirements, ...clarifying } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.execute(
            `INSERT INTO project (name, prompt, folder, goal, model, clarifying_state) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, prompt, cwd, response, selectedModel, JSON.stringify(clarifying)]
        );
        const pk = result.insertId;
        await insertRequirements(conn, pk, requirements ?? []);
        await conn.commit();
        res.status(201).json(await serializeSession(pk));
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}));

router.put('/sessions/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, prompt, cwd, response, selectedModel, requirements, ...clarifying } = req.body;
    const [existing] = await pool.execute('SELECT pk FROM project WHERE pk = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Session not found' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(
            `UPDATE project SET name=?, prompt=?, folder=?, goal=?, model=?, clarifying_state=?, updated_at=NOW() WHERE pk=?`,
            [name, prompt, cwd, response, selectedModel, JSON.stringify(clarifying), id]
        );
        await conn.execute('DELETE FROM entry WHERE project_id = ?', [id]);
        await insertRequirements(conn, Number(id), requirements ?? []);
        await conn.commit();
        res.json(await serializeSession(id));
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}));

router.delete('/sessions/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [existing] = await pool.execute('SELECT pk FROM project WHERE pk = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Session not found' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM entry WHERE project_id = ?', [id]);
        await conn.execute('DELETE FROM claude_call WHERE project_id = ?', [id]);
        await conn.execute('DELETE FROM project WHERE pk = ?', [id]);
        await conn.commit();
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}));

export default router;
