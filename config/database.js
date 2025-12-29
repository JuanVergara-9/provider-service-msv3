require('dotenv').config();
const path = require('path');

// Use SQLite for local development if no DATABASE_URL is set
const useSqlite = !process.env.DATABASE_URL;

const postgresBase = {
  dialect: 'postgres',
  logging: false,
  define: { underscored: true, timestamps: true },
  timezone: '-03:00'
};

const sqliteBase = {
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: false,
  define: { underscored: true, timestamps: true }
};

module.exports = {
  development: useSqlite ? sqliteBase : {
    ...postgresBase,
    url: process.env.DATABASE_URL,
    dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {}
  },
  production: {
    ...postgresBase,
    url: process.env.DATABASE_URL,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
  },
  test: useSqlite ? sqliteBase : {
    ...postgresBase,
    url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
  }
};
