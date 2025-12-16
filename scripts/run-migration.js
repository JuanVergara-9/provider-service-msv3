require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Cargar configuración de base de datos
const config = require('../config/database');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Crear conexión Sequelize
const sequelize = dbConfig.url 
    ? new Sequelize(dbConfig.url, dbConfig)
    : new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

async function runMigration() {
    try {
        console.log('Conectando a la base de datos...');
        await sequelize.authenticate();
        console.log('Conexión exitosa.');

        // Leer y ejecutar la migración
        const migrationPath = path.join(__dirname, '../migrations/20250101-007-add-delivery-status-to-messages.js');
        const migration = require(migrationPath);

        console.log('Ejecutando migración: add-delivery-status-to-messages...');
        const queryInterface = sequelize.getQueryInterface();
        const Sequelize = sequelize.constructor;
        
        await migration.up(queryInterface, Sequelize);
        console.log('✅ Migración ejecutada exitosamente!');

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error);
        await sequelize.close();
        process.exit(1);
    }
}

runMigration();

