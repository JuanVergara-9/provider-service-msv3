'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/internal.controller');

function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-key'];
  const expected = process.env.CREDIT_EVENTS_INTERNAL_KEY || process.env.INTERNAL_API_KEY || process.env.JWT_SECRET || '';
  if (!expected) {
    console.error('[Internal] CRITICAL: CREDIT_EVENTS_INTERNAL_KEY / JWT_SECRET not set; internal routes disabled.');
    return res.status(503).json({ error: { code: 'SERVICE_MISCONFIG', message: 'Internal API not configured' } });
  }
  if (!key || key !== expected) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing x-internal-key' } });
  }
  next();
}

router.get('/providers/:id/reputation-consent', requireInternalKey, ctrl.getReputationConsent);

module.exports = router;
