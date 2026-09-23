// 1. Unhandled Routes ke liye Error (404 Not Found)
const notFound = (req, res, next) => {
    const error = new Error(`Route Nahi Mila - ${req.originalUrl}`);
    res.status(404);
    next(error); // Error aglay middleware tak bhej dega
};

// 2. Global Custom Error Handler
const errorHandler = (err, req, res, next) => {
    // Agar pehle se status code set nahi hua toh default 500 (Server Error) rakhein
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        message: err.message,
        // Development mode mein error ki poori trace details dikhayega, production mein chhupa dega
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};

module.exports = { notFound, errorHandler };