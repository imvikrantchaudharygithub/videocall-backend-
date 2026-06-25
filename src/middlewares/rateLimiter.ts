import rateLimit from 'express-rate-limit';

// Global rate limit: 100 requests per minute
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});

// OTP rate limit: 1 per 60 seconds per IP
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  keyGenerator: (req) => req.body?.phone || req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Please wait 60 seconds before requesting another OTP' },
  },
});

// Auth endpoints: 10 per minute
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many auth requests' },
  },
});
