'use strict';
module.exports = {
  async up(q) {
    const now = new Date();
    
    // Primero necesitamos obtener las categorías
    const categories = await q.sequelize.query('SELECT id, name FROM categories', { type: q.sequelize.QueryTypes.SELECT });
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });

    // Crear usuarios de prueba primero
    const users = await q.sequelize.query('SELECT id FROM users LIMIT 6', { type: q.sequelize.QueryTypes.SELECT });
    
    if (users.length === 0) {
      // Si no hay usuarios, crear algunos
      await q.bulkInsert('users', [
        { email: 'juan@plomero.com', password_hash: '$2a$10$dummy', role: 'provider', is_email_verified: true, created_at: now, updated_at: now },
        { email: 'maria@electricista.com', password_hash: '$2a$10$dummy', role: 'provider', is_email_verified: true, created_at: now, updated_at: now },
        { email: 'carlos@gasista.com', password_hash: '$2a$10$dummy', role: 'provider', is_email_verified: true, created_at: now, updated_at: now },
        { email: 'ana@pintora.com', password_hash: '$2a$10$dummy', role: 'provider', is_email_verified: true, created_at: now, updated_at: now },
        { email: 'luis@carpintero.com', password_hash: '$2a$10$dummy', role: 'provider', is_email_verified: true, created_at: now, updated_at: now },
        { email: 'sofia@reparaciones.com', password_hash: '$2a$10$dummy', role: 'provider', is_email_verified: true, created_at: now, updated_at: now }
      ]);
      
      // Obtener los IDs de los usuarios recién creados
      const newUsers = await q.sequelize.query('SELECT id FROM users ORDER BY id DESC LIMIT 6', { type: q.sequelize.QueryTypes.SELECT });
      users.push(...newUsers);
    }

    // Crear proveedores de prueba
    await q.bulkInsert('providers', [
      {
        user_id: users[0]?.id || 1,
        category_id: categoryMap['Plomería'] || 1,
        first_name: 'Juan',
        last_name: 'Carlos',
        contact_email: 'juan@plomero.com',
        phone_e164: '+542604123456',
        whatsapp_e164: '+542604123456',
        description: 'Especialista en instalaciones de agua y gas. 15 años de experiencia.',
        province: 'Mendoza',
        city: 'San Rafael',
        address: 'Av. San Martín 1234',
        lat: -34.620993999999996,
        lng: -68.355415,
        status: 'active',
        years_experience: 15,
        price_hint: 5000,
        emergency_available: true,
        created_at: now,
        updated_at: now
      },
      {
        user_id: users[1]?.id || 2,
        category_id: categoryMap['Electricidad'] || 3,
        first_name: 'María',
        last_name: 'González',
        contact_email: 'maria@electricista.com',
        phone_e164: '+542604987654',
        whatsapp_e164: '+542604987654',
        description: 'Instalaciones eléctricas residenciales y comerciales. Emergencias 24hs.',
        province: 'Mendoza',
        city: 'San Rafael',
        address: 'Calle Mitre 567',
        lat: -34.625000,
        lng: -68.360000,
        status: 'active',
        years_experience: 12,
        price_hint: 8000,
        emergency_available: true,
        created_at: now,
        updated_at: now
      },
      {
        user_id: users[2]?.id || 3,
        category_id: categoryMap['Gasistas'] || 2,
        first_name: 'Carlos',
        last_name: 'Rodríguez',
        contact_email: 'carlos@gasista.com',
        phone_e164: '+542604456789',
        whatsapp_e164: '+542604456789',
        description: 'Instalaciones de gas natural y envasado. Certificado por ENARGAS.',
        province: 'Mendoza',
        city: 'San Rafael',
        address: 'Av. Rivadavia 890',
        lat: -34.618000,
        lng: -68.352000,
        status: 'active',
        years_experience: 20,
        price_hint: 12000,
        emergency_available: true,
        created_at: now,
        updated_at: now
      },
      {
        user_id: users[3]?.id || 4,
        category_id: categoryMap['Pintura'] || 5,
        first_name: 'Ana',
        last_name: 'Martínez',
        contact_email: 'ana@pintora.com',
        phone_e164: '+542604333444',
        whatsapp_e164: '+542604333444',
        description: 'Pintura interior y exterior. Trabajos de calidad con garantía.',
        province: 'Mendoza',
        city: 'San Rafael',
        address: 'Calle San Luis 234',
        lat: -34.622000,
        lng: -68.358000,
        status: 'active',
        years_experience: 8,
        price_hint: 6000,
        emergency_available: false,
        created_at: now,
        updated_at: now
      },
      {
        user_id: users[4]?.id || 5,
        category_id: categoryMap['Carpintería'] || 4,
        first_name: 'Luis',
        last_name: 'Fernández',
        contact_email: 'luis@carpintero.com',
        phone_e164: '+542604777888',
        whatsapp_e164: '+542604777888',
        description: 'Muebles a medida, reparaciones y restauraciones. Trabajo artesanal.',
        province: 'Mendoza',
        city: 'San Rafael',
        address: 'Av. Libertador 456',
        lat: -34.615000,
        lng: -68.350000,
        status: 'active',
        years_experience: 25,
        price_hint: 15000,
        emergency_available: false,
        created_at: now,
        updated_at: now
      },
      {
        user_id: users[5]?.id || 6,
        category_id: categoryMap['Reparación de electrodomésticos'] || 6,
        first_name: 'Sofía',
        last_name: 'López',
        contact_email: 'sofia@reparaciones.com',
        phone_e164: '+542604999000',
        whatsapp_e164: '+542604999000',
        description: 'Reparación de electrodomésticos, heladeras, lavarropas, microondas.',
        province: 'Mendoza',
        city: 'San Rafael',
        address: 'Calle Belgrano 789',
        lat: -34.628000,
        lng: -68.362000,
        status: 'active',
        years_experience: 10,
        price_hint: 7000,
        emergency_available: true,
        created_at: now,
        updated_at: now
      }
    ]);
  },
  async down(q) {
    await q.bulkDelete('providers', null, {});
  }
};


