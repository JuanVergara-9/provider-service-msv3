const jwt = require('jsonwebtoken');
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

function verifyAccessToken(token, opts = {}) {
  // tolerancia 10s por si el reloj está apenas corrido
  return jwt.verify(token, ACCESS_SECRET, { clockTolerance: 10, ...opts });
}
module.exports = { verifyAccessToken };
