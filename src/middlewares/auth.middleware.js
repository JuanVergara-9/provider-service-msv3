const { unauthorized } = require('../utils/httpError');
const { verifyAccessToken } = require('../utils/jwt');

const ADMIN_EMAIL = 'app.miservicio@gmail.com';

function requireAuth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return next(unauthorized('AUTH.MISSING_TOKEN','Token requerido'));
  try {
    const payload = verifyAccessToken(token); // ya incluye clockTolerance

    // Validar que userId existe y es un número válido
    if (!payload.userId || isNaN(Number(payload.userId)) || Number(payload.userId) <= 0) {
      console.error('[Auth Middleware] Error de validación: ID de usuario inválido en el token.');
      return next(unauthorized('AUTH.INVALID_USER_ID', 'ID de usuario inválido en el token'));
    }

    req.user = { id: Number(payload.userId), userId: Number(payload.userId), role: payload.role, email: payload.email };
    return next();
  } catch (e) {
    console.error('[Auth Middleware] Error de validación: Token inválido o expirado.');
    const msg = /expired/i.test(e.message) ? 'Token expirado' : 'Token inválido';
    return next(unauthorized('AUTH.INVALID_TOKEN', msg));
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role === 'admin' || req.user?.email === ADMIN_EMAIL) {
      return next();
    }
    return next(unauthorized('AUTH.FORBIDDEN', 'No tenés permisos para realizar esta acción'));
  });
}

module.exports = { requireAuth, requireAdmin };
