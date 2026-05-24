import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { recommendDrivers, calculateDistance } from '@/lib/recommendation-engine';

// POST /api/recommendations/drivers - Get driver recommendations for a package
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'DISPATCHER' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { weight, volume, isCritical, deliveryLat, deliveryLong, warehouseLat, warehouseLong } = body;

    // Validate required fields
    if (
      weight === undefined ||
      volume === undefined ||
      isCritical === undefined ||
      !Number.isFinite(Number(deliveryLat)) ||
      !Number.isFinite(Number(deliveryLong))
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate estimated distance
    const startLat = Number.isFinite(Number(warehouseLat)) ? Number(warehouseLat) : 27.7172;
    const startLong = Number.isFinite(Number(warehouseLong)) ? Number(warehouseLong) : 85.3120;
    const distance = calculateDistance(startLat, startLong, Number(deliveryLat), Number(deliveryLong));

    // Fetch all available drivers with profiles
    const drivers = await prisma.user.findMany({
      where: {
        role: 'DRIVER',
        driverProfile: {
          isNot: null,
        },
      },
      include: {
        driverProfile: true,
      },
    });

    // Filter drivers with profiles
    const driversWithProfiles = drivers
      .filter((driver) => driver.driverProfile !== null)
      .map((driver) => ({
        id: driver.id,
        name: driver.name,
        email: driver.email,
        driverProfile: driver.driverProfile!,
      }));

    if (driversWithProfiles.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'No drivers with profiles found',
      });
    }

    // Get recommendations
    const recommendations = recommendDrivers(
      {
        weight,
        volume,
        isCritical,
        distance,
      },
      driversWithProfiles,
      5 // Get top 5 recommendations
    );

    return NextResponse.json({
      recommendations: recommendations.map((rec) => ({
        driverId: rec.driver.id,
        driverName: rec.driver.name || rec.driver.email,
        driverEmail: rec.driver.email,
        matchScore: rec.matchScore,
        reasons: rec.reasons,
        profile: {
          vehicleType: rec.driver.driverProfile.vehicleType,
          maxCapacity: rec.driver.driverProfile.maxCapacity,
          maxVolume: rec.driver.driverProfile.maxVolume,
          experienceYears: rec.driver.driverProfile.experienceYears,
          rating: rec.driver.driverProfile.rating,
          totalDeliveries: rec.driver.driverProfile.totalDeliveries,
          isAvailable: rec.driver.driverProfile.isAvailable,
        },
      })),
      packageInfo: {
        weight,
        volume,
        isCritical,
        estimatedDistance: Math.round(distance * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error getting driver recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to get driver recommendations' },
      { status: 500 }
    );
  }
}
