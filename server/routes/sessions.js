import { Router } from 'express';
import pool from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { serializeSession } from './sessionHelpers.js';
import { randomUUID } from 'node:crypto';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────

function ensureUuid(id) {
    return id || randomUUID();
}

/**
 * Upsert entries by uuid. Returns a Map<clientId, dbPk> for parent linking.
 */
async function upsertRequirements(conn, projectPk, requirements, existingByUuid, parentPk = null) {
    for (let i = 0; i < requirements.length; i++) {
        const r = requirements[i];
        const uuid = ensureUuid(r.id);
        const existing = existingByUuid.get(uuid);

        let pk;
        if (existing) {
            await conn.execute(
                `UPDATE entry SET title=?, description=?, test=?, stage=?, confidence=?, parent_id=?, sort_order=?, uuid=?, updated_at=NOW() WHERE pk=?`,
                [r.title, r.definition, JSON.stringify(r.tests ?? []), r.stage ?? 'proposal', r.confidence, parentPk, i, uuid, existing.pk]
            );
            pk = existing.pk;
        } else {
            const [result] = await conn.execute(
                `INSERT INTO entry (title, description, test, stage, confidence, project_id, parent_id, sort_order, uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [r.title, r.definition, JSON.stringify(r.tests ?? []), r.stage ?? 'proposal', r.confidence, projectPk, parentPk, i, uuid]
            );
            pk = result.insertId;
        }

        if (r.children?.length > 0) {
            await upsertRequirements(conn, projectPk, r.children, existingByUuid, pk);
        }
    }
}

function collectUuids(requirements) {
    const uuids = new Set();
    for (const r of requirements) {
        if (r.id) uuids.add(r.id);
        if (r.children?.length > 0) {
            for (const u of collectUuids(r.children)) uuids.add(u);
        }
    }
    return uuids;
}

async function loadFullSession(pk) {
    const [projects] = await pool.execute('SELECT * FROM project WHERE pk = ?', [pk]);
    const project = projects[0];
    if (!project) return null;
    const [entries] = await pool.execute('SELECT * FROM entry WHERE project_id = ?', [pk]);
    const [assumptions] = await pool.execute('SELECT * FROM assumption WHERE project_id = ? ORDER BY sort_order', [pk]);
    const [goalIterations] = await pool.execute('SELECT * FROM goal_iteration WHERE project_id = ? ORDER BY sort_order', [pk]);
    return serializeSession(project, entries, assumptions, goalIterations);
}

// ── Routes ───────────────────────────────────────────────────────────

router.get('/sessions', asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute('SELECT pk, name, updated_at FROM project ORDER BY updated_at DESC');
    res.json(rows.map(r => ({ id: String(r.pk), name: r.name, updatedAt: r.updated_at })));
}));

router.get('/sessions/:id', asyncHandler(async (req, res) => {
    const session = await loadFullSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
}));

router.post('/sessions', asyncHandler(async (req, res) => {
    const {
        name, prompt, cwd, response, selectedModel, requirements,
        clarifyingDone, assumptionsDone, questionsExhausted,
        allQuestions, allAnswers, assumptions, goalIterations,
        spec, specProgress,
        ...rest
    } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.execute(
            `INSERT INTO project (name, prompt, folder, goal, model, clarifying_done, assumptions_done, questions_exhausted, current_questions, current_answers, clarifying_state, spec, spec_progress)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name ?? null, prompt ?? null, cwd ?? null, response ?? null, selectedModel ?? null,
                clarifyingDone ? 1 : 0,
                assumptionsDone ? 1 : 0,
                questionsExhausted ? 1 : 0,
                JSON.stringify(allQuestions ?? []),
                JSON.stringify(allAnswers ?? []),
                JSON.stringify(rest),
                spec ?? null,
                specProgress ?? 0,
            ]
        );
        const pk = result.insertId;

        // Insert entries with uuids
        for (let i = 0; i < (requirements ?? []).length; i++) {
            await insertRequirementTree(conn, pk, requirements[i], null, i);
        }

        // Insert assumptions
        for (let i = 0; i < (assumptions ?? []).length; i++) {
            const a = assumptions[i];
            await conn.execute(
                `INSERT INTO assumption (uuid, project_id, text, rationale, confidence, impact, status, edited_text, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [ensureUuid(a.id), pk, a.text, a.rationale, a.confidence, a.impact, a.status ?? 'pending', a.editedText ?? null, i]
            );
        }

        // Insert goal iterations
        for (let i = 0; i < (goalIterations ?? []).length; i++) {
            const g = goalIterations[i];
            await conn.execute(
                `INSERT INTO goal_iteration (uuid, project_id, goal_text, questions, answers, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
                [randomUUID(), pk, g.goalText ?? '', JSON.stringify(g.questions ?? []), JSON.stringify(g.answers ?? []), i]
            );
        }

        await conn.commit();
        res.status(201).json(await loadFullSession(pk));
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}));

async function insertRequirementTree(conn, projectPk, req, parentPk, sortOrder) {
    const uuid = ensureUuid(req.id);
    const [result] = await conn.execute(
        `INSERT INTO entry (title, description, test, stage, confidence, project_id, parent_id, sort_order, uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.title, req.definition, JSON.stringify(req.tests ?? []), req.stage ?? 'proposal', req.confidence, projectPk, parentPk, sortOrder, uuid]
    );
    const pk = result.insertId;
    for (let i = 0; i < (req.children ?? []).length; i++) {
        await insertRequirementTree(conn, projectPk, req.children[i], pk, i);
    }
}

router.put('/sessions/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        name, prompt, cwd, response, selectedModel, requirements,
        clarifyingDone, assumptionsDone, questionsExhausted,
        allQuestions, allAnswers, assumptions, goalIterations,
        spec, specProgress, wizardStep,
        ...rest
    } = req.body;

    const [existing] = await pool.execute('SELECT pk FROM project WHERE pk = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Session not found' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Update project row
        await conn.execute(
            `UPDATE project SET name=?, prompt=?, folder=?, goal=?, model=?,
             clarifying_done=?, assumptions_done=?, questions_exhausted=?,
             current_questions=?, current_answers=?, clarifying_state=?,
             spec=?, spec_progress=?, wizard_step=?, updated_at=NOW()
             WHERE pk=?`,
            [
                name ?? null, prompt ?? null, cwd ?? null, response ?? null, selectedModel ?? null,
                clarifyingDone ? 1 : 0,
                assumptionsDone ? 1 : 0,
                questionsExhausted ? 1 : 0,
                JSON.stringify(allQuestions ?? []),
                JSON.stringify(allAnswers ?? []),
                JSON.stringify(rest),
                spec ?? null,
                specProgress ?? 0,
                wizardStep ?? null,
                id,
            ]
        );

        // ── Upsert entries by uuid ──
        const [existingEntries] = await conn.execute('SELECT pk, uuid FROM entry WHERE project_id = ?', [id]);
        const existingByUuid = new Map();
        for (const e of existingEntries) {
            if (e.uuid) existingByUuid.set(e.uuid, e);
        }

        const incomingUuids = collectUuids(requirements ?? []);
        await upsertRequirements(conn, Number(id), requirements ?? [], existingByUuid);

        // Delete entries that are no longer present
        for (const e of existingEntries) {
            if (e.uuid && !incomingUuids.has(e.uuid)) {
                await conn.execute('DELETE FROM entry WHERE pk = ?', [e.pk]);
            }
        }
        // Delete entries without uuids (legacy)
        for (const e of existingEntries) {
            if (!e.uuid) {
                await conn.execute('DELETE FROM entry WHERE pk = ?', [e.pk]);
            }
        }

        // ── Upsert assumptions by uuid ──
        const [existingAssumptions] = await conn.execute('SELECT pk, uuid FROM assumption WHERE project_id = ?', [id]);
        const existingAssumpByUuid = new Map(existingAssumptions.filter(a => a.uuid).map(a => [a.uuid, a]));
        const incomingAssumpUuids = new Set();

        for (let i = 0; i < (assumptions ?? []).length; i++) {
            const a = assumptions[i];
            const uuid = ensureUuid(a.id);
            incomingAssumpUuids.add(uuid);
            const ex = existingAssumpByUuid.get(uuid);
            if (ex) {
                await conn.execute(
                    `UPDATE assumption SET text=?, rationale=?, confidence=?, impact=?, status=?, edited_text=?, sort_order=?, updated_at=NOW() WHERE pk=?`,
                    [a.text, a.rationale, a.confidence, a.impact, a.status ?? 'pending', a.editedText ?? null, i, ex.pk]
                );
            } else {
                await conn.execute(
                    `INSERT INTO assumption (uuid, project_id, text, rationale, confidence, impact, status, edited_text, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uuid, Number(id), a.text, a.rationale, a.confidence, a.impact, a.status ?? 'pending', a.editedText ?? null, i]
                );
            }
        }
        // Delete removed assumptions
        for (const a of existingAssumptions) {
            if (!incomingAssumpUuids.has(a.uuid)) {
                await conn.execute('DELETE FROM assumption WHERE pk = ?', [a.pk]);
            }
        }

        // ── Upsert goal iterations ──
        // Goal iterations are append-mostly; we replace by sort_order position.
        await conn.execute('DELETE FROM goal_iteration WHERE project_id = ?', [id]);
        for (let i = 0; i < (goalIterations ?? []).length; i++) {
            const g = goalIterations[i];
            await conn.execute(
                `INSERT INTO goal_iteration (uuid, project_id, goal_text, questions, answers, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
                [randomUUID(), Number(id), g.goalText ?? '', JSON.stringify(g.questions ?? []), JSON.stringify(g.answers ?? []), i]
            );
        }

        await conn.commit();
        res.json(await loadFullSession(id));
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
        await conn.execute('DELETE FROM assumption WHERE project_id = ?', [id]);
        await conn.execute('DELETE FROM goal_iteration WHERE project_id = ?', [id]);
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
