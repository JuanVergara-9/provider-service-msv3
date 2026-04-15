'use strict';

/**
 * Insignias de confianza (admin): has_background_check, is_certified.
 * Flujo de matrícula/credencial: certification_status + certification_doc_url.
 */
module.exports = {
  async up(q, S) {
    const table = 'providers';
    const t = await q.describeTable(table);

    try {
      await q.sequelize.query(
        `CREATE TYPE enum_providers_certification_status AS ENUM ('not_submitted', 'pending', 'verified', 'rejected');`
      );
    } catch (e) {
      if (!String(e.message || '').includes('already exists')) throw e;
    }

    if (!t.has_background_check) {
      await q.addColumn(table, 'has_background_check', {
        type: S.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    if (!t.is_certified) {
      await q.addColumn(table, 'is_certified', {
        type: S.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    if (!t.certification_status) {
      await q.addColumn(table, 'certification_status', {
        type: S.ENUM('not_submitted', 'pending', 'verified', 'rejected'),
        allowNull: false,
        defaultValue: 'not_submitted'
      });
    }
    if (!t.certification_doc_url) {
      await q.addColumn(table, 'certification_doc_url', { type: S.STRING(512), allowNull: true });
    }
    if (!t.certification_rejection_reason) {
      await q.addColumn(table, 'certification_rejection_reason', { type: S.STRING, allowNull: true });
    }
  },

  async down(q, S) {
    const table = 'providers';
    const t = await q.describeTable(table);
    if (t.certification_rejection_reason) await q.removeColumn(table, 'certification_rejection_reason').catch(() => {});
    if (t.certification_doc_url) await q.removeColumn(table, 'certification_doc_url').catch(() => {});
    if (t.certification_status) await q.removeColumn(table, 'certification_status').catch(() => {});
    if (t.is_certified) await q.removeColumn(table, 'is_certified').catch(() => {});
    if (t.has_background_check) await q.removeColumn(table, 'has_background_check').catch(() => {});
    try {
      await q.sequelize.query('DROP TYPE IF EXISTS "enum_providers_certification_status";');
    } catch (_) {}
  }
};
