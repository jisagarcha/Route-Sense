const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function seedDemoUsers() {
  try {
    console.log('🚀 Seeding demo users...');

    // 1. Admin User
    const adminEmail = 'admin@admin.com';
    const adminPassword = 'anihortes';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hashedAdminPassword,
        role: 'ADMIN',
        name: 'Admin User'
      },
      create: {
        email: adminEmail,
        name: 'Admin User',
        password: hashedAdminPassword,
        role: 'ADMIN'
      }
    });
    console.log(`✅ Created/Updated Admin User: ${adminEmail} (password: ${adminPassword})`);

    // 2. Dispatcher User
    const dispatcherEmail = 'dispatcher@gmail.com';
    const dispatcherPassword = 'dispatcher';
    const hashedDispatcherPassword = await bcrypt.hash(dispatcherPassword, 10);
    
    await prisma.user.upsert({
      where: { email: dispatcherEmail },
      update: {
        password: hashedDispatcherPassword,
        role: 'DISPATCHER',
        name: 'Dispatcher User'
      },
      create: {
        email: dispatcherEmail,
        name: 'Dispatcher User',
        password: hashedDispatcherPassword,
        role: 'DISPATCHER'
      }
    });
    console.log(`✅ Created/Updated Dispatcher User: ${dispatcherEmail} (password: ${dispatcherPassword})`);

    // 3. Driver User
    const driverEmail = 'rajesh.driver@delivery.com';
    const driverPassword = 'driverdai';
    const hashedDriverPassword = await bcrypt.hash(driverPassword, 10);
    
    const driverUser = await prisma.user.upsert({
      where: { email: driverEmail },
      update: {
        password: hashedDriverPassword,
        role: 'DRIVER',
        name: 'Rajesh Driver'
      },
      create: {
        email: driverEmail,
        name: 'Rajesh Driver',
        password: hashedDriverPassword,
        role: 'DRIVER'
      }
    });
    console.log(`✅ Created/Updated Driver User: ${driverEmail} (password: ${driverPassword})`);

    // Ensure driver profile exists for Rajesh Driver
    const existingProfile = await prisma.driverProfile.findUnique({
      where: { userId: driverUser.id }
    });

    if (!existingProfile) {
      await prisma.driverProfile.create({
        data: {
          userId: driverUser.id,
          vehicleType: '2-wheeler',
          maxCapacity: 50,
          maxVolume: 20,
          experienceYears: 5,
          rating: 4.8,
          totalDeliveries: 245,
          isAvailable: true
        }
      });
      console.log(`✅ Created Driver Profile for Rajesh Driver`);
    } else {
      console.log(`ℹ️  Driver Profile for Rajesh Driver already exists`);
    }

    console.log('\n🎉 Demo users seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding demo users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoUsers();
