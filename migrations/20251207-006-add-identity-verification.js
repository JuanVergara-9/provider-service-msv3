'use strict';

module.exports = {
  async up(q, S) {
    const table = 'providers';
    const t = await q.describeTable(table);
    
    // Agregar enum si no existe (PostgreSQL)
    try {
      await q.sequelize.query(`CREATE TYPE enum_providers_identity_status AS ENUM ('not_submitted', 'pending', 'verified', 'rejected');`);
    } catch (e) {
      // El tipo ya existe, continuar
      if (!e.message.includes('already exists')) throw e;
    }
    
    if (!t.identity_status) {
      await q.addColumn(table, 'identity_status', { 
        type: S.ENUM('not_submitted', 'pending', 'verified', 'rejected'), 
        defaultValue: 'not_submitted',
        allowNull: false 
      });
    }
    
    // URLs de las imágenes (Deberían ser privadas en un futuro, por ahora URLs normales)
    if (!t.identity_dni_front_url) {
      await q.addColumn(table, 'identity_dni_front_url', { type: S.STRING(512), allowNull: true });
    }
    if (!t.identity_dni_back_url) {
      await q.addColumn(table, 'identity_dni_back_url', { type: S.STRING(512), allowNull: true });
    }
    if (!t.identity_selfie_url) {
      await q.addColumn(table, 'identity_selfie_url', { type: S.STRING(512), allowNull: true });
    }
    
    // Mensaje de rechazo opcional
    if (!t.identity_rejection_reason) {
      await q.addColumn(table, 'identity_rejection_reason', { type: S.STRING, allowNull: true });
    }
  },

  async down(q, S) {
    const table = 'providers';
    const t = await q.describeTable(table);
    
    if (t.identity_rejection_reason) {
      await q.removeColumn(table, 'identity_rejection_reason');
    }
    if (t.identity_selfie_url) {
      await q.removeColumn(table, 'identity_selfie_url');
    }
    if (t.identity_dni_back_url) {
      await q.removeColumn(table, 'identity_dni_back_url');
    }
    if (t.identity_dni_front_url) {
      await q.removeColumn(table, 'identity_dni_front_url');
    }
    if (t.identity_status) {
      await q.removeColumn(table, 'identity_status'); 
    }
    
    // Eliminar ENUM en postgres
    try {
      await q.sequelize.query('DROP TYPE IF EXISTS "enum_providers_identity_status";');
    } catch (e) {
      // Ignorar si no existe
    }
  }
};

