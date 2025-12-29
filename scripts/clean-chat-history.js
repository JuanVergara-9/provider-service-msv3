require('dotenv').config();
const db = require('../models');
const sequelize = db.sequelize;

(async function cleanChatHistory() {
  try {
    // Verificar que no estemos en producción
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production') {
      console.error('❌ ERROR: Este script no se puede ejecutar en producción');
      console.error('   Si realmente querés borrar datos en producción, edita el script y elimina esta validación');
      process.exit(1);
    }

    console.log('🔍 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa\n');

    // Mostrar estadísticas antes de borrar
    const [messagesBefore] = await sequelize.query(`SELECT COUNT(*) as count FROM messages`);
    const [conversationsBefore] = await sequelize.query(`SELECT COUNT(*) as count FROM conversations`);
    
    console.log('📊 Estado actual:');
    console.log(`   Mensajes: ${messagesBefore[0].count}`);
    console.log(`   Conversaciones: ${conversationsBefore[0].count}\n`);

    // Borrar mensajes primero (por las foreign keys)
    console.log('🗑️  Borrando mensajes...');
    const [messagesResult] = await sequelize.query(`DELETE FROM messages`);
    console.log(`✅ Mensajes borrados: ${messagesResult.rowCount || 0}`);

    // Borrar conversaciones
    console.log('🗑️  Borrando conversaciones...');
    const [conversationsResult] = await sequelize.query(`DELETE FROM conversations`);
    console.log(`✅ Conversaciones borradas: ${conversationsResult.rowCount || 0}`);

    // Mostrar estadísticas después de borrar
    const [messagesAfter] = await sequelize.query(`SELECT COUNT(*) as count FROM messages`);
    const [conversationsAfter] = await sequelize.query(`SELECT COUNT(*) as count FROM conversations`);
    
    console.log('\n📊 Estado final:');
    console.log(`   Mensajes: ${messagesAfter[0].count}`);
    console.log(`   Conversaciones: ${conversationsAfter[0].count}`);

    console.log('\n✅ Limpieza de chat completada');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e);
    process.exit(1);
  }
})();

