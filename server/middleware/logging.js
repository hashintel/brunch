import db from '../db.js';

const logApiCall = db.prepare(`
    INSERT INTO api_call (method, path, status_code, model, session_id, request_body, response_body, duration_ms, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export function loggingMiddleware(req, res, next) {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    let responseBody = null;

    res.json = function (body) {
        responseBody = body;
        return originalJson(body);
    };

    res.on('finish', () => {
        try {
            logApiCall.run(
                req.method,
                req.path,
                res.statusCode,
                req.body?.model ?? null,
                req.body?.sessionId ?? req.params?.id ?? null,
                req.method !== 'GET' ? JSON.stringify(req.body) : null,
                responseBody ? JSON.stringify(responseBody) : null,
                Date.now() - start,
                res.statusCode >= 400 && responseBody?.error ? responseBody.error : null,
            );
        } catch (e) {
            console.error('[db] failed to log api call:', e.message);
        }
    });

    next();
}
