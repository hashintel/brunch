import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/history/claude', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const model = req.query.model;
    const cwd = req.query.cwd;

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

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params);

    let countSql = 'SELECT COUNT(*) as count FROM claude_call';
    const countParams = [];
    if (conditions.length > 0) {
        countSql += ' WHERE ' + conditions.join(' AND ');
        if (model) countParams.push(model);
        if (cwd) countParams.push(cwd);
    }
    const total = db.prepare(countSql).get(...countParams);

    res.json({ rows, total: total.count });
});

router.get('/history', (req, res) => {
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

    const rows = db.prepare(sql).all(...params);
    const total = db.prepare(
        `SELECT COUNT(*) as count FROM api_call${path ? ' WHERE path = ?' : ''}`
    ).get(...(path ? [path] : []));

    res.json({ rows, total: total.count });
});

export default router;
