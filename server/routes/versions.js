import { Router } from 'express';
import pool from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { serializeProject } from './sessionHelpers.js';

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
        const [result] = await conn.execute("CALL DOLT_COMMIT('-m', ?)", [message.trim()]);
        const hash = result[0]?.hash ?? null;
        res.json({ hash, message: message.trim() });
    } finally {
        conn.release();
    }
}));

// GET /api/versions/log — commit history
router.get('/versions/log', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const [rows] = await pool.execute(
        'SELECT commit_hash, committer, message, date FROM dolt_log ORDER BY date DESC LIMIT ?',
        [limit]
    );
    res.json({ commits: rows });
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
    const tableNames = ['project', 'entry'];

    for (const table of tableNames) {
        try {
            // DOLT_DIFF doesn't support prepared statement bind vars,
            // so we interpolate directly (commitHash is validated above, table is from allowlist)
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

    res.json(serializeProject(project, entries));
}));

export default router;
