export class AppError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}
export function notFoundHandler(_req, res) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: { code: "APP_ERROR", message: err.message }
        });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message }
    });
}
