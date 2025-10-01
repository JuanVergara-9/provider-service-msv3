'use strict';

module.exports = {
  async up(q, S) {
    const table = 'providers';
    // Add columns if not exist (safe for repeated runs in different envs)
    const t = await q.describeTable(table);
    if (!t.avatar_url) {
      await q.addColumn(table, 'avatar_url', { type: S.STRING(512), allowNull: true });
    }
    if (!t.avatar_public_id) {
      await q.addColumn(table, 'avatar_public_id', { type: S.STRING(256), allowNull: true });
    }
    if (!t.avatar_version) {
      await q.addColumn(table, 'avatar_version', { type: S.STRING(64), allowNull: true });
    }
  },
  async down(q) {
    const table = 'providers';
    const t = await q.describeTable(table);
    if (t.avatar_version) await q.removeColumn(table, 'avatar_version');
    if (t.avatar_public_id) await q.removeColumn(table, 'avatar_public_id');
    if (t.avatar_url) await q.removeColumn(table, 'avatar_url');
  }
};


