const jwt = require('jsonwebtoken');
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const GUEST_SECRET = process.env.JWT_GUEST_SECRET || process.env.JWT_ACCESS_SECRET;
const GUEST_EXPIRY = process.env.JWT_GUEST_EXPIRY || '7d';

function verifyAccessToken(token, opts = {}) {
  return jwt.verify(token, ACCESS_SECRET, { clockTolerance: 10, ...opts });
}

function signGuestToken(payload, opts = {}) {
  return jwt.sign(
    payload,
    GUEST_SECRET,
    { expiresIn: opts.expiresIn || GUEST_EXPIRY, ...opts }
  );
}

function verifyGuestToken(token, opts = {}) {
  return jwt.verify(token, GUEST_SECRET, { clockTolerance: 60, ...opts });
}

module.exports = { verifyAccessToken, signGuestToken, verifyGuestToken };
