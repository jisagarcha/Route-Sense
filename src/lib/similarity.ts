/**
 * Cosine Similarity for comparing route similarity
 * Used to find similar past routes based on visited locations
 */

export interface RouteVector {
  routeId: number;
  locations: string[];
  totalDistance: number;
  sourceLocation: string;
  targetLocation: string;
  createdAt: Date;
}

export interface SimilarRoute extends RouteVector {
  similarity: number;
}

/**
 * Compute cosine similarity between two sets of locations
 * Formula: cos(θ) = |A ∩ B| / (√|A| * √|B|)
 * For sets, this simplifies to Jaccard-like similarity
 * 
 * @param setA First set of location names
 * @param setB Second set of location names
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 || setB.length === 0) {
    return 0;
  }

  // Convert to sets for intersection calculation
  const setAUnique = new Set(setA);
  const setBUnique = new Set(setB);

  // Calculate intersection
  const intersection = new Set(
    [...setAUnique].filter((x) => setBUnique.has(x))
  );

  // Cosine similarity for sets
  const similarity =
    intersection.size / Math.sqrt(setAUnique.size * setBUnique.size);

  return similarity;
}

/**
 * Find similar routes based on cosine similarity
 * @param currentRoute Current route locations
 * @param pastRoutes Array of past routes to compare against
 * @param topN Number of top similar routes to return
 * @param minSimilarity Minimum similarity threshold (0-1)
 * @returns Array of similar routes sorted by similarity (descending)
 */
export function findSimilarRoutes(
  currentRoute: string[],
  pastRoutes: RouteVector[],
  topN: number = 3,
  minSimilarity: number = 0.1
): SimilarRoute[] {
  const similarRoutes: SimilarRoute[] = [];

  pastRoutes.forEach((pastRoute) => {
    const similarity = cosineSimilarity(currentRoute, pastRoute.locations);

    if (similarity >= minSimilarity) {
      similarRoutes.push({
        ...pastRoute,
        similarity,
      });
    }
  });

  // Sort by similarity descending and return top N
  return similarRoutes
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

/**
 * Calculate similarity percentage for display
 * @param similarity Similarity score (0-1)
 * @returns Percentage string
 */
export function getSimilarityPercentage(similarity: number): string {
  return `${(similarity * 100).toFixed(1)}%`;
}
