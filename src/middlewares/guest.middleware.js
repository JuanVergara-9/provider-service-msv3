'use strict';

const { verifyGuestToken } = require('../utils/jwt');

/**
 * Intercepta la entrada al perfil público con Magic Link.
 * Busca el token en: query.token, body.guestToken o Authorization Bearer.
 * Decodifica el JWT y adjunta requestId y workerId a la request para saber
 * qué pedido se está intentando cerrar (navegación blindada al contexto).
 * No falla si no hay token: req.guestRequestId / req.guestWorkerId quedan undefined.
 */
function validateGuestToken(req, _res, next) {
  let token =
    req.query?.token ||
    req.body?.guestToken ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    req.guestRequestId = undefined;
    req.guestWorkerId = undefined;
    return next();
  }

  try {
    const payload = verifyGuestToken(token);
    req.guestRequestId = payload.requestId != null ? Number(payload.requestId) : undefined;
    req.guestWorkerId = payload.workerId != null ? Number(payload.workerId) : undefined;
  } catch (_e) {
    req.guestRequestId = undefined;
    req.guestWorkerId = undefined;
  }
  return next();
}

module.exports = { validateGuestToken };
