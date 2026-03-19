import { Router } from 'express';
import pool from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

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

// GET /api/versions/diff/:commitHash — diff vs parent using DOLT_DIFF() table function
router.get('/versions/diff/:commitHash', asyncHandler(async (req, res) => {
    const { commitHash } = req.params;

    // Validate commitHash is alphanumeric (Dolt uses base-36: 0-9a-z, 32 chars)
    if (!/^[0-9a-z]+$/i.test(commitHash)) {
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
    const conn = await pool.getConnection();
    try {
        await conn.execute("CALL DOLT_RESET('--hard', ?)", [commitHash]);
        res.json({ ok: true, revertedTo: commitHash });
    } finally {
        conn.release();
    }
}));

export default router;
