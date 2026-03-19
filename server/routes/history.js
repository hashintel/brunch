import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/history/claude', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const model = req.query.model;

    let sql = 'SELECT * FROM claude_call';
    const params = [];

    if (model) {
        sql += ' WHERE model = ?';
        params.push(model);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params);
    const total = db.prepare(
        `SELECT COUNT(*) as count FROM claude_call${model ? ' WHERE model = ?' : ''}`
    ).get(...(model ? [model] : []));

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
