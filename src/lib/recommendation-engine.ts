/**
 * Driver Recommendation Engine
 * Uses Cosine Similarity algorithm to match packages with suitable drivers
 */

interface PackageAttributes {
  weight: number; // in kg
  volume: number; // in cubic feet
  isCritical: boolean;
  distance: number; // estimated distance in km
}

interface DriverAttributes {
  maxCapacity: number; // in kg
  maxVolume: number; // in cubic feet
  experienceYears: number;
  rating: number;
  totalDeliveries: number;
  vehicleType: string;
  isAvailable: boolean;
}

interface DriverWithProfile {
  id: string;
  name: string | null;
  email: string;
  driverProfile: DriverAttributes;
}

interface DriverRecommendation {
  driver: DriverWithProfile;
  matchScore: number; // 0-100
  reasons: string[];
}

/**
 * Normalize a value to 0-1 range
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (value - min) / (max - min);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Multi-criteria match score computation between package and driver
 */
function computeDriverMatchScore(
  pkg: PackageAttributes,
  driver: DriverAttributes
): number {
  // 1. Capacity fit (ideal is 50-85% utilization; penalize severe under-utilization or near-capacity)
  const weightUtil = driver.maxCapacity > 0 ? pkg.weight / driver.maxCapacity : 1;
  const volumeUtil = driver.maxVolume > 0 ? pkg.volume / driver.maxVolume : 1;
  
  // Score is highest (1.0) when utilization is around 60-80%, lowest if <10% (wasting large vehicle)
  const weightFit = Math.max(0, 1 - Math.abs(weightUtil - 0.7));
  const volumeFit = Math.max(0, 1 - Math.abs(volumeUtil - 0.7));
  const capacityFitScore = (weightFit * 0.6 + volumeFit * 0.4);

  // 2. Driver Rating (normalized 0 to 1)
  const ratingScore = Math.max(0, Math.min(driver.rating / 5, 1));

  // 3. Driver Experience (normalized 0 to 1, capped at 10 years)
  const experienceScore = Math.max(0, Math.min(driver.experienceYears / 10, 1));

  // 4. Distance and Vehicle Suitability
  let vehicleDistanceSuitability = 0.8;
  const vehicle = (driver.vehicleType || "").toLowerCase();
  if (vehicle.includes("2-wheeler") || vehicle.includes("bike") || vehicle.includes("motorbike")) {
    vehicleDistanceSuitability = pkg.distance <= 15 ? 1.0 : 0.6;
  } else if (vehicle.includes("van") || vehicle.includes("car")) {
    vehicleDistanceSuitability = pkg.distance <= 35 ? 0.95 : 0.8;
  } else if (vehicle.includes("truck")) {
    vehicleDistanceSuitability = pkg.distance > 10 ? 1.0 : 0.65;
  }

  // Multi-criteria weighting:
  // If critical package: experience and rating are weighted heavily
  let baseScore = 0;
  if (pkg.isCritical) {
    baseScore =
      capacityFitScore * 0.25 +
      ratingScore * 0.35 +
      experienceScore * 0.25 +
      vehicleDistanceSuitability * 0.15;
  } else {
    baseScore =
      capacityFitScore * 0.40 +
      ratingScore * 0.25 +
      experienceScore * 0.15 +
      vehicleDistanceSuitability * 0.20;
  }

  // Convert to 0-100 scale (typically 60-95 base)
  let finalScore = 50 + baseScore * 45;

  // Bonus for current availability
  if (driver.isAvailable) {
    finalScore += 5;
  }

  return Math.min(Math.round(finalScore * 100) / 100, 100);
}

/**
 * Calculate match reasons based on driver and package attributes
 */
function generateMatchReasons(
  pkg: PackageAttributes,
  driver: DriverAttributes
): string[] {
  const reasons: string[] = [];

  // Check capacity match
  const capacityUtilization = (pkg.weight / driver.maxCapacity) * 100;
  if (capacityUtilization < 50) {
    reasons.push('Excellent capacity match');
  } else if (capacityUtilization < 80) {
    reasons.push('Good capacity match');
  }

  // Check volume match
  const volumeUtilization = (pkg.volume / driver.maxVolume) * 100;
  if (volumeUtilization < 50) {
    reasons.push('Excellent volume capacity');
  }

  // Check vehicle type suitability
  if (pkg.weight < 50 && driver.vehicleType === '2-wheeler') {
    reasons.push('Perfect for 2-wheeler delivery');
  } else if (pkg.weight >= 50 && driver.vehicleType === '4-wheeler') {
    reasons.push('Suitable vehicle for heavy load');
  }

  // Check experience for critical items
  if (pkg.isCritical && driver.experienceYears >= 3) {
    reasons.push('Experienced with critical deliveries');
  }

  // Check rating
  if (driver.rating >= 4.5) {
    reasons.push('High customer rating');
  }

  // Check delivery history
  if (driver.totalDeliveries > 100) {
    reasons.push('Proven track record');
  }

  // Check availability
  if (driver.isAvailable) {
    reasons.push('Currently available');
  }

  return reasons;
}

/**
 * Recommend drivers for a package using cosine similarity
 */
export function recommendDrivers(
  packageAttributes: PackageAttributes,
  availableDrivers: DriverWithProfile[],
  topN: number = 3
): DriverRecommendation[] {
  const recommendations: DriverRecommendation[] = availableDrivers
    .filter((driver) => {
      // Filter out drivers who can't handle the package
      const canHandleWeight = driver.driverProfile.maxCapacity >= packageAttributes.weight;
      const canHandleVolume = driver.driverProfile.maxVolume >= packageAttributes.volume;
      return canHandleWeight && canHandleVolume;
    })
    .map((driver) => {
      const matchScore = computeDriverMatchScore(packageAttributes, driver.driverProfile);
      const reasons = generateMatchReasons(packageAttributes, driver.driverProfile);

      return {
        driver,
        matchScore,
        reasons,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, topN);

  return recommendations;
}

/**
 * Calculate estimated distance based on coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}
