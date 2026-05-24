const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDriverProfile() {
  try {
    const driver = await prisma.user.findUnique({
      where: { email: 'driver@driver.com' }
    });

    if (!driver) {
      console.log('Driver not found');
      await prisma.$disconnect();
      return;
    }

    // Check if profile already exists
    const existingProfile = await prisma.driverProfile.findUnique({
      where: { userId: driver.id }
    });

    if (existingProfile) {
      console.log('Driver profile already exists');
      await prisma.$disconnect();
      return;
    }

    // Create driver profile
    const profile = await prisma.driverProfile.create({
      data: {
        userId: driver.id,
        vehicleType: '4-wheeler',
        maxCapacity: 150,
        maxVolume: 50,
        experienceYears: 5,
        rating: 4.8,
        totalDeliveries: 250,
        isAvailable: true
      }
    });

    console.log('✅ Driver profile created successfully!');
    console.log('Profile:', JSON.stringify(profile, null, 2));
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
  }
}

createDriverProfile();
