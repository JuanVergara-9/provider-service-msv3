'use strict';

const router = require('express').Router();
const { validateGuestToken } = require('../middlewares/guest.middleware');

/**
 * GET /api/v1/guest/validate?token=xxx
 * Valida el Magic Link y devuelve requestId y workerId para que el frontend
 * sepa qué pedido está cerrando sin necesidad de compartir el secreto JWT.
 */
router.get('/validate', validateGuestToken, (req, res) => {
  if (req.guestRequestId == null || req.guestWorkerId == null) {
    return res.status(400).json({ error: 'Invalid or expired guest token' });
  }
  res.json({ requestId: req.guestRequestId, workerId: req.guestWorkerId });
});

module.exports = router;
