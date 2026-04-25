'use strict';

const svc = require('../services/provider.service');

/**
 * GET /api/v1/internal/providers/:id/reputation-consent
 * Uso: notification-service (caché) para el gancho de credit_events.
 * Auth: x-internal-key (mismo secreto compartido que credit-events en notification).
 */
async function getReputationConsent(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid provider id' } });
    }
    const row = await svc.getReputationConsent(id);
    if (!row) {
      return res.status(404).json({ error: { code: 'PROVIDER.NOT_FOUND', message: 'Proveedor no encontrado' } });
    }
    res.json({ provider_id: id, reputation_consent: row.reputation_consent });
  } catch (e) {
    next(e);
  }
}

module.exports = { getReputationConsent };
