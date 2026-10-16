const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    }),
  ],
});

// File logs only for local/non-serverless — Vercel filesystem is read-only
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (process.env.NODE_ENV === 'production' && !isServerless) {
  const logsDir = path.join(__dirname, '../../logs');
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    logger.add(new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }));
    logger.add(new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }));
  } catch (err) {
    console.warn('File logging disabled:', err.message);
  }
}

module.exports = logger;
