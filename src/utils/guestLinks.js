'use strict';

const { signGuestToken } = require('./jwt');

/**
 * Genera un Magic Link firmado para que el cliente vea el perfil del trabajador
 * en contexto de un pedido (requestId). Blinda la navegación a esa necesidad puntual.
 * @param {number} workerId - ID del proveedor (Provider.id)
 * @param {number} requestId - ID del service request
 * @param {object} opts - { baseUrl: string }
 * @returns {string} URL completa con token (ej: https://miservicio.ar/proveedores/123?token=...)
 */
function generateWorkerProfileLink(workerId, requestId, opts = {}) {
  const baseUrl = (opts.baseUrl || process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const payload = { workerId: Number(workerId), requestId: Number(requestId) };
  const token = signGuestToken(payload);
  return `${baseUrl}/proveedores/${workerId}?token=${encodeURIComponent(token)}`;
}

module.exports = { generateWorkerProfileLink };
