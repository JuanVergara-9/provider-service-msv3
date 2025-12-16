'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Primero crear el tipo ENUM si no existe
        await queryInterface.sequelize.query(`
            DO $$ BEGIN
                CREATE TYPE enum_messages_delivery_status AS ENUM ('pending', 'sent', 'delivered', 'read');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Agregar la columna delivery_status
        await queryInterface.addColumn('messages', 'delivery_status', {
            type: Sequelize.ENUM('pending', 'sent', 'delivered', 'read'),
            defaultValue: 'sent',
            allowNull: false
        });

        // Actualizar mensajes existentes
        await queryInterface.sequelize.query(`
            UPDATE messages 
            SET delivery_status = CASE 
                WHEN is_read = true THEN 'read'::enum_messages_delivery_status
                ELSE 'sent'::enum_messages_delivery_status
            END
        `);
    },

    async down(queryInterface, Sequelize) {
        // Remover la columna
        await queryInterface.removeColumn('messages', 'delivery_status');
        
        // Eliminar el tipo ENUM
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_messages_delivery_status;');
    }
};

