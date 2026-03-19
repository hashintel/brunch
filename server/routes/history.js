import { Router } from 'express';
import pool from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/history/claude', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const model = req.query.model;
    const cwd = req.query.cwd;
    const projectId = req.query.projectId;

    let sql = 'SELECT * FROM claude_call';
    const params = [];
    const conditions = [];

    if (model) {
        conditions.push('model = ?');
        params.push(model);
    }
    if (cwd) {
        conditions.push('cwd = ?');
        params.push(cwd);
    }
    if (projectId) {
        conditions.push('project_id = ?');
        params.push(projectId);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(sql, params);

    let countSql = 'SELECT COUNT(*) as count FROM claude_call';
    const countParams = [];
    if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        if (model) countParams.push(model);
        if (cwd) countParams.push(cwd);
        if (projectId) countParams.push(projectId);
    }
    const [countRows] = await pool.execute(countSql, countParams);

    res.json({ rows, total: countRows[0].count });
}));

router.get('/history', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const path = req.query.path;

    let sql = 'SELECT * FROM api_call';
    const params = [];

    if (path) {
        sql += ' WHERE path = ?';
        params.push(path);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(sql, params);
    const countSql = `SELECT COUNT(*) as count FROM api_call${path ? ' WHERE path = ?' : ''}`;
    const [countRows] = await pool.execute(countSql, path ? [path] : []);

    res.json({ rows, total: countRows[0].count });
}));

export default router;
