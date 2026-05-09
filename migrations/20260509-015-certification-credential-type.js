'use strict';

/**
 * Tipo de credencial que declara el trabajador al subir documento:
 * matricula | certificado (insignía distinta al aprobar).
 */
module.exports = {
  async up(q, S) {
    const table = 'providers';
    const t = await q.describeTable(table);
    if (!t.certification_credential_type) {
      await q.addColumn(table, 'certification_credential_type', {
        type: S.STRING(32),
        allowNull: true,
      });
    }
  },

  async down(q) {
    const table = 'providers';
    const t = await q.describeTable(table);
    if (t.certification_credential_type) {
      await q.removeColumn(table, 'certification_credential_type').catch(() => {});
    }
  },
};
