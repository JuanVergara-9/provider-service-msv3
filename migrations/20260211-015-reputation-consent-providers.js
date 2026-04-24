'use strict';

module.exports = {
  async up(q, S) {
    const table = 'providers';
    const t = await q.describeTable(table);
    if (!t.reputation_consent) {
      await q.addColumn(table, 'reputation_consent', {
        type: S.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },
  async down(q) {
    const table = 'providers';
    const t = await q.describeTable(table);
    if (t.reputation_consent) {
      await q.removeColumn(table, 'reputation_consent');
    }
  }
};
