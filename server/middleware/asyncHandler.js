export const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, _req, res, _next) {
    console.error('[server] unhandled error:', err?.message ?? String(err));
    if (res.headersSent) {
        res.end();
        return;
    }
    // If Transfer-Encoding was set (streaming response), remove it before sending JSON error
    if (res.getHeader('Transfer-Encoding')) {
        res.removeHeader('Transfer-Encoding');
    }
    res.status(500).json({ error: 'Internal server error' });
}
