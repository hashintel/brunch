export const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, _req, res, _next) {
    console.error('[server] unhandled error:', err.message ?? err);
    if (res.headersSent) {
        res.end();
        return;
    }
    res.status(500).json({ error: 'Internal server error' });
}
