const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { db, initDb } = require('./config/db');

const id  = () => randomUUID();
const str = (v) => JSON.stringify(v);

const workingHours = (open = '09:00', close = '21:00', weekendOpen = open, weekendClose = close) => ({
  monday:    { open, close, closed: false },
  tuesday:   { open, close, closed: false },
  wednesday: { open, close, closed: false },
  thursday:  { open, close, closed: false },
  friday:    { open, close, closed: false },
  saturday:  { open: weekendOpen, close: weekendClose, closed: false },
  sunday:    { open: weekendOpen, close: weekendClose, closed: false },
});

const seedData = (force = false) => {
  // ── 1. Create tables FIRST ────────────────────────────────────────────────
  initDb();

  // ── 2. Check existing data ────────────────────────────────────────────────
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (existing > 0 && !force) {
    console.log('Database already has data. Use --force to reseed.');
    return;
  }

  // ── 3. Prepare statements AFTER tables exist ──────────────────────────────
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password, phone, role)
    VALUES (@id, @name, @email, @password, @phone, @role)
  `);

  const insertBusiness = db.prepare(`
    INSERT INTO businesses (
      id, owner_id, name, description, category, city, district, address,
      lat, lng, photos, amenities, working_hours, contacts,
      rating, review_count, status,
      vr_tour_url, vr_preview_image, business_type
    ) VALUES (
      @id, @ownerId, @name, @description, @category, @city, @district, @address,
      @lat, @lng, @photos, @amenities, @workingHours, @contacts,
      @rating, @reviewCount, @status,
      @vrTourUrl, @vrPreviewImage, @businessType
    )
  `);

  const insertService = db.prepare(`
    INSERT INTO services (
      id, business_id, name, description, price, duration_minutes,
      is_flash_deal, discount_price, flash_deal_ends_at
    ) VALUES (
      @id, @businessId, @name, @description, @price, @durationMinutes,
      @isFlashDeal, @discountPrice, @flashDealEndsAt
    )
  `);

  const insertReview = db.prepare(`
    INSERT INTO reviews (id, user_id, business_id, rating, comment)
    VALUES (@id, @userId, @businessId, @rating, @comment)
  `);

  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      id, user_id, business_id, service_id, date,
      start_time, end_time, total_price, original_price,
      final_price, was_flash_deal, status
    ) VALUES (
      @id, @userId, @businessId, @serviceId, @date,
      @startTime, @endTime, @totalPrice, @originalPrice,
      @finalPrice, @wasFlashDeal, @status
    )
  `);

  const insertCategory = db.prepare(
    'INSERT INTO categories (id, name_en, name_ru, name_uz, icon) VALUES (?, ?, ?, ?, ?)'
  );

  // ── 4. Run everything in a transaction ────────────────────────────────────
  const run = db.transaction(() => {
    // Clear existing data
    db.exec(`
      DELETE FROM notifications;
      DELETE FROM favorites;
      DELETE FROM reviews;
      DELETE FROM bookings;
      DELETE FROM services;
      DELETE FROM businesses;
      DELETE FROM categories;
      DELETE FROM users;
    `);

    // Try to clear promoted_deals if table exists
    try { db.exec('DELETE FROM promoted_deals;'); } catch {}

    // Users
    const pw = (plain) => bcrypt.hashSync(plain, 10);
    const admin  = { id: id(), name: 'Admin',            email: 'admin@hizmat.top',  password: pw('admin123'), phone: '+998900000001', role: 'admin'  };
    const owner1 = { id: id(), name: 'Alisher Karimov',  email: 'owner@hizmat.top',  password: pw('owner123'), phone: '+998900000002', role: 'owner'  };
    const owner2 = { id: id(), name: 'Diana Kim',         email: 'owner2@hizmat.top', password: pw('owner123'), phone: '+998900000003', role: 'owner'  };
    const user1  = { id: id(), name: 'Dilshod Testov',   email: 'user@hizmat.top',   password: pw('user123'),  phone: '+998900000004', role: 'user'   };
    const user2  = { id: id(), name: 'Nodira Usmonova',  email: 'user2@hizmat.top',  password: pw('user123'),  phone: '+998900000005', role: 'user'   };
    [admin, owner1, owner2, user1, user2].forEach(u => insertUser.run(u));

    // Categories
    [
      ['barbershop', 'Barbershop',    'Барбершоп',       "Sartaroshxona",    'scissors'],
      ['game_club',  'Game club',     'Игровой клуб',    'Oyin klubi',       'gamepad'],
      ['restaurant', 'Restaurant',    'Ресторан',        'Restoran',         'utensils'],
      ['salon',      'Beauty salon',  'Салон красоты',   "Go'zallik saloni", 'sparkles'],
      ['car_wash',   'Car wash',      'Автомойка',       'Avtoyuvish',       'car'],
      ['gym',        'Gym',           'Фитнес',          'Sport zal',        'dumbbell'],
      ['other',      'Other',         'Другое',          'Boshqa',           'map-pin'],
    ].forEach(row => insertCategory.run(...row));

    // Photo URLs
    const photos = {
      barber: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900&h=520&fit=crop',
      game:   'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=900&h=520&fit=crop',
      resto:  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=520&fit=crop',
      salon:  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&h=520&fit=crop',
      car:    'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=900&h=520&fit=crop',
      gym:    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&h=520&fit=crop',
    };

    // Businesses
    const businesses = [
      {
        id: id(), ownerId: owner1.id,
        name: 'Barbershop SULTAN', category: 'barbershop',
        description: "Premium men's barbershop with classic haircuts, beard care and hot towel service.",
        city: 'Tashkent', district: 'Mirzo Ulugbek', address: 'Buyuk Ipak Yoli street, 107',
        lat: 41.3111, lng: 69.2796,
        photos: str([photos.barber]),
        amenities: str(['WiFi', 'Coffee', 'Parking']),
        workingHours: str(workingHours('09:00', '21:00', '10:00', '20:00')),
        contacts: str({ phone: '+998901234567', telegram: '@sultan_barber', instagram: '@sultan_barbershop' }),
        rating: 4.8, reviewCount: 42, status: 'approved',
        vrTourUrl: '', vrPreviewImage: photos.barber, businessType: 'service',
      },
      {
        id: id(), ownerId: owner2.id,
        name: 'BarberHouse Premium', category: 'barbershop',
        description: 'Modern barbershop with experienced masters, styling, kids haircuts and beard modeling.',
        city: 'Tashkent', district: 'Chilonzor', address: 'Bunyodkor street, 21',
        lat: 41.2867, lng: 69.2198,
        photos: str(['https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&h=520&fit=crop']),
        amenities: str(['WiFi', 'Drinks', 'Kids area']),
        workingHours: str(workingHours('10:00', '22:00', '10:00', '21:00')),
        contacts: str({ phone: '+998907654321', telegram: '@barberhouse' }),
        rating: 4.5, reviewCount: 28, status: 'approved',
        vrTourUrl: '', vrPreviewImage: '', businessType: 'service',
      },
      {
        id: id(), ownerId: owner1.id,
        name: 'CyberArena Tashkent', category: 'game_club',
        description: 'Gaming club with powerful PCs, consoles, VR zone and fast internet.',
        city: 'Tashkent', district: 'Yunusobod', address: 'Amir Temur avenue, 88',
        lat: 41.3367, lng: 69.2569,
        photos: str([photos.game]),
        amenities: str(['WiFi', 'VR zone', 'Tournaments', 'Cafe']),
        workingHours: str(workingHours('09:00', '23:00', '10:00', '02:00')),
        contacts: str({ phone: '+998933334444', telegram: '@cyberarena_tg' }),
        rating: 4.6, reviewCount: 67, status: 'approved',
        vrTourUrl: '', vrPreviewImage: '', businessType: 'service',
      },
      {
        id: id(), ownerId: owner1.id,
        name: 'Samarkand Restaurant', category: 'restaurant',
        description: 'Uzbek cuisine, plov, samsa, kebab and a cozy family atmosphere.',
        city: 'Tashkent', district: 'Yakkasaroy', address: 'Shota Rustaveli street, 32',
        lat: 41.296, lng: 69.2683,
        photos: str([photos.resto]),
        amenities: str(['Terrace', 'Parking', 'Live music', 'Kids area']),
        workingHours: str(workingHours('11:00', '23:00', '11:00', '00:00')),
        contacts: str({ phone: '+998901112233', telegram: '@samarkand_resto' }),
        rating: 4.9, reviewCount: 89, status: 'approved',
        vrTourUrl: '', vrPreviewImage: '', businessType: 'service',
      },
      {
        id: id(), ownerId: owner2.id,
        name: 'Beauty Lab Salon', category: 'salon',
        description: 'Full-cycle beauty salon: manicure, pedicure, haircuts, coloring and care procedures.',
        city: 'Tashkent', district: 'Chilonzor', address: 'Qatortol street, 7',
        lat: 41.278, lng: 69.205,
        photos: str([photos.salon]),
        amenities: str(['WiFi', 'Tea and coffee', 'Parking']),
        workingHours: str({
          ...workingHours('09:00', '20:00', '10:00', '19:00'),
          sunday: { closed: true, open: '00:00', close: '00:00' },
        }),
        contacts: str({ phone: '+998901778899', instagram: '@beautylab_uz' }),
        rating: 4.9, reviewCount: 72, status: 'approved',
        vrTourUrl: '', vrPreviewImage: '', businessType: 'service',
      },
      {
        id: id(), ownerId: owner1.id,
        name: 'AutoSpa Express', category: 'car_wash',
        description: 'Professional car wash, detailing, polishing and salon dry cleaning.',
        city: 'Tashkent', district: 'Sergeli', address: 'Fargona Yoli street, 45',
        lat: 41.25, lng: 69.23,
        photos: str([photos.car]),
        amenities: str(['Waiting area', 'WiFi', 'Coffee', 'Security cameras']),
        workingHours: str(workingHours('08:00', '20:00', '08:00', '18:00')),
        contacts: str({ phone: '+998901990011', telegram: '@autospa_express' }),
        rating: 4.4, reviewCount: 31, status: 'approved',
        vrTourUrl: '', vrPreviewImage: '', businessType: 'service',
      },
      {
        id: id(), ownerId: owner1.id,
        name: 'FitZone Gym', category: 'gym',
        description: 'Modern gym with cardio area, strength machines, group classes and personal trainers.',
        city: 'Tashkent', district: 'Yunusobod', address: 'Yunusobod 4th block',
        lat: 41.345, lng: 69.245,
        photos: str([photos.gym]),
        amenities: str(['Showers', 'Lockers', 'Sauna', 'Trainers']),
        workingHours: str(workingHours('06:00', '23:00', '08:00', '22:00')),
        contacts: str({ phone: '+998901223344', instagram: '@fitzone_uz' }),
        rating: 4.5, reviewCount: 45, status: 'approved',
        vrTourUrl: '', vrPreviewImage: '', businessType: 'service',
      },
      {
        id: id(), ownerId: owner2.id,
        name: 'New Barber Shop', category: 'barbershop',
        description: 'New barbershop waiting for admin approval.',
        city: 'Tashkent', district: 'Mirobod', address: 'Nukus street, 55',
        lat: 41.305, lng: 69.27,
        photos: str([]),
        amenities: str(['WiFi']),
        workingHours: str(workingHours('10:00', '20:00')),
        contacts: str({ phone: '+998909998877' }),
        rating: 0, reviewCount: 0, status: 'pending',
        vrTourUrl: '', vrPreviewImage: '', businessType: 'service',
      },
    ];
    businesses.forEach(b => insertBusiness.run(b));

    const byName = Object.fromEntries(businesses.map(b => [b.name, b]));

    // Services
    const flashEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const services = [
      ['Barbershop SULTAN',  'Men haircut',           'Classic or modern haircut',        50000, 40, 1, 30000],
      ['Barbershop SULTAN',  'Beard trim',             'Beard modeling and care',           35000, 25, 0, null],
      ['Barbershop SULTAN',  'Haircut + beard',        'Full barber package',               75000, 60, 0, null],
      ['BarberHouse Premium','Haircut',                'Stylish men haircut',               70000, 45, 1, 45000],
      ['BarberHouse Premium','Kids haircut',           'Haircut for children under 12',     40000, 30, 0, null],
      ['CyberArena Tashkent','PC Standard',            'Gaming PC for one hour',            25000, 60, 0, null],
      ['CyberArena Tashkent','PC VIP',                 'VIP gaming place for one hour',     40000, 60, 0, null],
      ['CyberArena Tashkent','VR session',             'Meta Quest VR session',             50000, 30, 0, null],
      ['Samarkand Restaurant','Table reservation',     'Reserve a table for dinner',            0,120, 0, null],
      ['Samarkand Restaurant','Plov portion',          'Traditional Uzbek plov',            45000, 60, 0, null],
      ['Beauty Lab Salon',   'Manicure with gel polish','Classic manicure and gel polish',  80000, 60, 1, 55000],
      ['Beauty Lab Salon',   'Hair coloring',          'Single-tone premium coloring',     200000,120, 0, null],
      ['AutoSpa Express',    'Express wash',           'Contactless body wash',             40000, 20, 1, 25000],
      ['AutoSpa Express',    'Full wash',              'Body, interior, mats and glass',    80000, 45, 0, null],
      ['FitZone Gym',        'Single visit',           'Gym and cardio area access',        35000, 90, 1, 20000],
      ['FitZone Gym',        'Personal training',      'Training with a personal coach',   100000, 60, 0, null],
    ].map(([bizName, name, description, price, durationMinutes, isFlashDeal, discountPrice]) => ({
      id: id(),
      businessId: byName[bizName].id,
      name, description, price, durationMinutes, isFlashDeal,
      discountPrice: discountPrice || null,
      flashDealEndsAt: isFlashDeal ? flashEnd : null,
    }));
    services.forEach(s => insertService.run(s));

    const byBizService = Object.fromEntries(
      services.map(s => [`${s.businessId}:${s.name}`, s])
    );

    // Reviews
    [
      [user1.id, byName['Barbershop SULTAN'].id,      5, 'Excellent service and very clean place.'],
      [user2.id, byName['Barbershop SULTAN'].id,      5, 'The master did a perfect beard trim.'],
      [user1.id, byName['CyberArena Tashkent'].id,    4, 'Great PCs, sometimes busy in the evening.'],
      [user2.id, byName['Samarkand Restaurant'].id,   5, 'Best plov in the city!'],
      [user1.id, byName['Beauty Lab Salon'].id,       5, 'Friendly staff and careful service.'],
      [user2.id, byName['AutoSpa Express'].id,        4, 'Fast and high-quality car wash.'],
    ].forEach(([userId, businessId, rating, comment]) =>
      insertReview.run({ id: id(), userId, businessId, rating, comment })
    );

    // Demo bookings (always tomorrow so they're not "past")
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    [
      { userId: user1.id, biz: byName['Barbershop SULTAN'],    svcName: 'Haircut + beard', start: '14:00', end: '15:00', price: 75000, status: 'confirmed' },
      { userId: user1.id, biz: byName['CyberArena Tashkent'],  svcName: 'PC VIP',           start: '18:00', end: '20:00', price: 80000, status: 'pending'   },
      { userId: user2.id, biz: byName['Samarkand Restaurant'],  svcName: 'Table reservation',start: '19:00', end: '21:00', price: 0,     status: 'pending'   },
    ].forEach(({ userId, biz, svcName, start, end, price, status }) => {
      const svc = byBizService[`${biz.id}:${svcName}`];
      if (!svc) return;
      insertBooking.run({
        id: id(), userId, businessId: biz.id, serviceId: svc.id,
        date: tomorrow, startTime: start, endTime: end,
        totalPrice: price, originalPrice: price, finalPrice: price,
        wasFlashDeal: 0, status,
      });
    });

    // Favorites
    db.prepare('INSERT INTO favorites (user_id, business_id) VALUES (?, ?)')
      .run(user1.id, byName['Barbershop SULTAN'].id);
  });

  run();

  console.log('\n✅ Database seeded successfully!\n');
  console.log('  Admin:   admin@hizmat.top  / admin123');
  console.log('  Owner 1: owner@hizmat.top  / owner123');
  console.log('  Owner 2: owner2@hizmat.top / owner123');
  console.log('  User 1:  user@hizmat.top   / user123');
  console.log('  User 2:  user2@hizmat.top  / user123\n');
};

module.exports = seedData;

if (require.main === module) {
  seedData(process.argv.includes('--force'));
}
