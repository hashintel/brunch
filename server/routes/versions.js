import { Router } from 'express';
import pool from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { serializeSession } from './sessionHelpers.js';

const router = Router();

// GET /api/versions/status — uncommitted changes
router.get('/versions/status', asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute('SELECT table_name, staged, status FROM dolt_status');
    res.json({ changes: rows });
}));

// POST /api/versions/commit — stage all + commit
router.post('/versions/commit', asyncHandler(async (req, res) => {
    const { message } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Commit message is required' });
    }
    const conn = await pool.getConnection();
    try {
        await conn.execute("CALL DOLT_ADD('-A')");
        const result = await conn.execute("CALL DOLT_COMMIT('-m', ?)", [message.trim()]);
        // mysql2 CALL returns [[resultSet, OkPacket], fields] — resultSet may itself be an array of rows
        const flat = result.flat(3);
        const hash = flat.find(r => r?.hash)?.hash ?? null;
        res.json({ hash, message: message.trim() });
    } finally {
        conn.release();
    }
}));

// GET /api/versions/log — commit history (optionally filtered by projectId)
router.get('/versions/log', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const { projectId } = req.query;

    if (projectId) {
        // Collect commit hashes where this project's data actually changed
        // dolt_diff_<table> only contains rows for commits that modified data
        const diffTables = [
            { table: 'dolt_diff_project', toCol: 'to_pk', fromCol: 'from_pk' },
            { table: 'dolt_diff_entry', toCol: 'to_project_id', fromCol: 'from_project_id' },
            { table: 'dolt_diff_assumption', toCol: 'to_project_id', fromCol: 'from_project_id' },
            { table: 'dolt_diff_goal_iteration', toCol: 'to_project_id', fromCol: 'from_project_id' },
        ];
        const hashSet = new Set();
        for (const { table, toCol, fromCol } of diffTables) {
            try {
                const [rows] = await pool.execute(
                    `SELECT DISTINCT to_commit AS h FROM ${table} WHERE ${toCol} = ?
                     UNION
                     SELECT DISTINCT from_commit AS h FROM ${table} WHERE ${fromCol} = ?`,
                    [projectId, projectId]
                );
                for (const r of rows) if (r.h) hashSet.add(r.h);
            } catch {
                // Table may not exist in older schemas
            }
        }

        if (hashSet.size === 0) {
            return res.json({ commits: [] });
        }

        // Fetch full log and filter to relevant hashes
        const [allRows] = await pool.execute(
            'SELECT commit_hash, committer, message, date FROM dolt_log ORDER BY date DESC LIMIT 500'
        );
        const filtered = allRows.filter(r => hashSet.has(r.commit_hash)).slice(0, limit);
        return res.json({ commits: filtered });
    }

    const [rows] = await pool.execute(
        'SELECT commit_hash, committer, message, date FROM dolt_log ORDER BY date DESC LIMIT ?',
        [limit]
    );
    res.json({ commits: rows });
}));

// GET /api/versions/diff/working — diff HEAD vs working (uncommitted changes)
router.get('/versions/diff/working', asyncHandler(async (_req, res) => {
    const tables = {};
    const tableNames = ['project', 'entry', 'assumption', 'goal_iteration'];

    for (const table of tableNames) {
        try {
            const [rows] = await pool.query(
                `SELECT * FROM DOLT_DIFF('HEAD', 'WORKING', '${table}')`
            );
            if (rows.length > 0) {
                tables[table] = rows;
            }
        } catch (e) {
            console.log(`[versions] working diff ${table}: ${e.message}`);
        }
    }

    res.json({ tables, from: 'HEAD', to: 'WORKING' });
}));

// Dolt commit hashes are 32-char base-36 (0-9a-v)
const COMMIT_HASH_RE = /^[0-9a-v]{32}$/;

// GET /api/versions/diff/:commitHash — diff vs parent using DOLT_DIFF() table function
router.get('/versions/diff/:commitHash', asyncHandler(async (req, res) => {
    const { commitHash } = req.params;

    if (!COMMIT_HASH_RE.test(commitHash)) {
        return res.status(400).json({ error: 'Invalid commit hash' });
    }

    const tables = {};
    const tableNames = ['project', 'entry', 'assumption', 'goal_iteration'];

    for (const table of tableNames) {
        try {
            const [rows] = await pool.query(
                `SELECT * FROM DOLT_DIFF('${commitHash}^', '${commitHash}', '${table}')`
            );
            if (rows.length > 0) {
                tables[table] = rows;
            }
        } catch (e) {
            // Table may not exist at that revision, or it's the initial commit with no parent
            console.log(`[versions] diff ${table}: ${e.message}`);
        }
    }

    res.json({ tables, from: `${commitHash}^`, to: commitHash });
}));

// POST /api/versions/revert/:commitHash — hard reset
router.post('/versions/revert/:commitHash', asyncHandler(async (req, res) => {
    const { commitHash } = req.params;

    if (!COMMIT_HASH_RE.test(commitHash)) {
        return res.status(400).json({ error: 'Invalid commit hash' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.execute("CALL DOLT_RESET('--hard', ?)", [commitHash]);
        res.json({ ok: true, revertedTo: commitHash });
    } finally {
        conn.release();
    }
}));

// GET /api/versions/checkout/:commitHash — read data as of a past commit
router.get('/versions/checkout/:commitHash', asyncHandler(async (req, res) => {
    const { commitHash } = req.params;
    const { sessionId } = req.query;

    if (!COMMIT_HASH_RE.test(commitHash)) {
        return res.status(400).json({ error: 'Invalid commit hash' });
    }
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId query parameter is required' });
    }

    // Query tables AS OF the given commit hash
    const [projects] = await pool.query(
        `SELECT * FROM \`project\` AS OF '${commitHash}' WHERE pk = ?`, [sessionId]
    );
    const project = projects[0];
    if (!project) {
        return res.status(404).json({ error: 'Project not found at this commit' });
    }
    const [entries] = await pool.query(
        `SELECT * FROM \`entry\` AS OF '${commitHash}' WHERE project_id = ?`, [sessionId]
    );

    // These tables may not exist in older commits — gracefully handle
    let assumptions = [];
    let goalIterations = [];
    try {
        const [rows] = await pool.query(
            `SELECT * FROM \`assumption\` AS OF '${commitHash}' WHERE project_id = ? ORDER BY sort_order`, [sessionId]
        );
        assumptions = rows;
    } catch (e) {
        console.log(`[versions] checkout assumption: ${e.message}`);
    }
    try {
        const [rows] = await pool.query(
            `SELECT * FROM \`goal_iteration\` AS OF '${commitHash}' WHERE project_id = ? ORDER BY sort_order`, [sessionId]
        );
        goalIterations = rows;
    } catch (e) {
        console.log(`[versions] checkout goal_iteration: ${e.message}`);
    }

    res.json(serializeSession(project, entries, assumptions, goalIterations));
}));

export default router;
