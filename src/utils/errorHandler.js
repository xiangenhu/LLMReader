/**
 * Error Handler Utility
 * Provides centralized error handling for the application
 */

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware for Express
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorMiddleware = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle ApiError instances
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details
    });
  }
  
  // Handle other errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // In production, don't expose internal error details
  const details = process.env.NODE_ENV === 'production' ? null : err.stack;
  
  res.status(statusCode).json({
    error: message,
    details
  });
};

/**
 * Async handler to catch errors in async route handlers
 * @param {Function} fn - The async route handler function
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  ApiError,
  errorMiddleware,
  asyncHandler
};
