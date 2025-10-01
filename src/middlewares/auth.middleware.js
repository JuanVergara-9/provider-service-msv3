const { unauthorized } = require('../utils/httpError');
const { verifyAccessToken } = require('../utils/jwt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function sha8(s){ return crypto.createHash('sha256').update(s || '').digest('hex').slice(0,8); }

function requireAuth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return next(unauthorized('AUTH.MISSING_TOKEN','Token requerido'));
  try {
    const payload = verifyAccessToken(token); // ya incluye clockTolerance
    console.log('[provider requireAuth] JWT payload:', payload); // LOGUEA EL PAYLOAD PARA VER userId
    
    // Validar que userId existe y es un número válido
    if (!payload.userId || isNaN(Number(payload.userId)) || Number(payload.userId) <= 0) {
      console.error('[provider requireAuth] Invalid userId in JWT:', payload.userId);
      return next(unauthorized('AUTH.INVALID_USER_ID', 'ID de usuario inválido en el token'));
    }
    
    req.user = { userId: Number(payload.userId), role: payload.role };
    return next();
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[provider requireAuth] JWT error:', e.name, e.message);
      const decoded = jwt.decode(token, { complete: true });
      console.error(' payload:', decoded?.payload);
      console.error(' secret hash (first8):', sha8(process.env.JWT_ACCESS_SECRET));
    }
    const msg = /expired/i.test(e.message) ? 'Token expirado' : 'Token inválido';
    return next(unauthorized('AUTH.INVALID_TOKEN', msg));
  }
}
module.exports = { requireAuth };
