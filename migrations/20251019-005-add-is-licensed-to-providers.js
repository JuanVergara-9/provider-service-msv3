'use strict';

module.exports = {
  async up(q, S) {
    const table = 'providers';
    const t = await q.describeTable(table);
    if (!t.is_licensed) {
      await q.addColumn(table, 'is_licensed', { type: S.BOOLEAN, allowNull: false, defaultValue: false });
    }
  },
  async down(q) {
    const table = 'providers';
    const t = await q.describeTable(table);
    if (t.is_licensed) await q.removeColumn(table, 'is_licensed');
  }
};


