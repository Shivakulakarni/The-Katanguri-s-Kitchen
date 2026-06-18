export const STRIPE_API_VERSION = '2024-12-18.acacia' as any;

// OTP
export const OTP_EXPIRY_SECONDS = 5 * 60;
export const OTP_PREFIX = 'otp:';

// Rate limiting
export const OTP_RATE_LIMIT = Number(process.env.OTP_RATE_LIMIT) || (process.env.NODE_ENV === 'production' ? 5 : 50);
export const LOGIN_RATE_LIMIT = Number(process.env.LOGIN_RATE_LIMIT) || (process.env.NODE_ENV === 'production' ? 10 : 100);
export const AUTH_RATE_WINDOW_SECONDS = 15 * 60;
export const PROMO_RATE_LIMIT = 30;
export const PROMO_RATE_WINDOW_SECONDS = 15 * 60;

// Account lockout
export const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
export const LOCKOUT_DURATION_SECONDS = parseInt(process.env.LOCKOUT_DURATION_SECONDS || '900'); // 15 minutes

// Cache
export const MENU_CACHE_TTL = 60;
export const MENU_CACHE_KEY = 'cache:menu:all';
export const CUSTOMER_ID_CACHE_TTL = 300;

// Kitchen location (used for dispatch/rider calculations)
export const KITCHEN_LAT = Number(process.env.KITCHEN_LAT) || 12.9716;
export const KITCHEN_LNG = Number(process.env.KITCHEN_LNG) || 77.5946;

// Rider
export const RIDER_SEARCH_RADIUS_KM = 5;
export const MAX_ACTIVE_ORDERS_PER_RIDER = 1;
export const RIDER_EARNING_PER_DELIVERY = 30;
