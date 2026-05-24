/**
 * Apriori Algorithm for Frequent Pattern Mining
 * Finds frequent itemsets (location combinations) in historical routes
 */

export interface FrequentItemset {
  items: string[];
  support: number;
  count: number;
  totalTransactions: number;
}

export interface AprioriResult {
  frequentItemsets: FrequentItemset[];
  minSupport: number;
  totalTransactions: number;
}

/**
 * Generate candidate itemsets of size k from frequent itemsets of size k-1
 * @param frequentItemsets Frequent itemsets of size k-1
 * @param k Size of itemsets to generate
 */
function generateCandidates(
  frequentItemsets: string[][],
  k: number
): string[][] {
  const candidates: string[][] = [];
  const seen = new Set<string>();

  for (let i = 0; i < frequentItemsets.length; i++) {
    for (let j = i + 1; j < frequentItemsets.length; j++) {
      // Join step: merge two itemsets if they share k-2 items
      const set1 = frequentItemsets[i];
      const set2 = frequentItemsets[j];

      // For k=2, just combine single items
      if (k === 2) {
        const candidate = Array.from(new Set([...set1, ...set2])).sort();
        if (candidate.length === k) {
          const key = candidate.join(',');
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push(candidate);
          }
        }
      } else {
        // Check if first k-2 items match
        const prefix1 = set1.slice(0, k - 2).join(',');
        const prefix2 = set2.slice(0, k - 2).join(',');

        if (prefix1 === prefix2) {
          const candidate = Array.from(
            new Set([...set1, ...set2])
          ).sort();
          if (candidate.length === k) {
            const key = candidate.join(',');
            if (!seen.has(key)) {
              seen.add(key);
              candidates.push(candidate);
            }
          }
        }
      }
    }
  }

  return candidates;
}

/**
 * Count support for itemsets in transactions
 * @param itemsets Candidate itemsets
 * @param transactions Array of transactions (routes)
 */
function countSupport(
  itemsets: string[][],
  transactions: string[][]
): Map<string, number> {
  const supportCount = new Map<string, number>();

  itemsets.forEach((itemset) => {
    let count = 0;
    const itemsetSet = new Set(itemset);

    transactions.forEach((transaction) => {
      const transactionSet = new Set(transaction);
      const hasAll = [...itemsetSet].every((item) =>
        transactionSet.has(item)
      );
      if (hasAll) {
        count++;
      }
    });

    supportCount.set(itemset.join(','), count);
  });

  return supportCount;
}

/**
 * Apriori algorithm to find frequent itemsets
 * Time Complexity: Exponential in worst case, but pruned by minimum support
 * 
 * @param transactions Array of transactions (each is an array of items/locations)
 * @param minSupport Minimum support threshold (0-1)
 * @param minItemsetSize Minimum size of itemsets to consider (default: 2)
 * @param maxItemsetSize Maximum size of itemsets to consider (default: unlimited)
 */
export function apriori(
  transactions: string[][],
  minSupport: number = 0.3,
  minItemsetSize: number = 2,
  maxItemsetSize?: number
): AprioriResult {
  const totalTransactions = transactions.length;
  const minCount = Math.ceil(minSupport * totalTransactions);
  const allFrequentItemsets: FrequentItemset[] = [];

  if (totalTransactions === 0) {
    return {
      frequentItemsets: [],
      minSupport,
      totalTransactions: 0,
    };
  }

  // Step 1: Find frequent 1-itemsets
  const itemCounts = new Map<string, number>();
  transactions.forEach((transaction) => {
    const uniqueItems = new Set(transaction);
    uniqueItems.forEach((item) => {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    });
  });

  let frequentItemsets: string[][] = [];
  itemCounts.forEach((count, item) => {
    if (count >= minCount) {
      frequentItemsets.push([item]);
      if (minItemsetSize <= 1) {
        allFrequentItemsets.push({
          items: [item],
          support: count / totalTransactions,
          count,
          totalTransactions,
        });
      }
    }
  });

  // Step 2: Iteratively find larger frequent itemsets
  let k = 2;
  while (frequentItemsets.length > 0) {
    if (maxItemsetSize && k > maxItemsetSize) {
      break;
    }

    // Generate candidates
    const candidates = generateCandidates(frequentItemsets, k);
    if (candidates.length === 0) {
      break;
    }

    // Count support for candidates
    const supportCounts = countSupport(candidates, transactions);

    // Filter candidates by minimum support
    const newFrequentItemsets: string[][] = [];
    supportCounts.forEach((count, key) => {
      if (count >= minCount) {
        const items = key.split(',');
        newFrequentItemsets.push(items);

        if (k >= minItemsetSize) {
          allFrequentItemsets.push({
            items,
            support: count / totalTransactions,
            count,
            totalTransactions,
          });
        }
      }
    });

    frequentItemsets = newFrequentItemsets;
    k++;
  }

  // Sort by support (descending) and then by itemset size (descending)
  allFrequentItemsets.sort((a, b) => {
    if (b.support !== a.support) {
      return b.support - a.support;
    }
    return b.items.length - a.items.length;
  });

  return {
    frequentItemsets: allFrequentItemsets,
    minSupport,
    totalTransactions,
  };
}

/**
 * Format support as percentage
 * @param support Support value (0-1)
 */
export function formatSupport(support: number): string {
  return `${(support * 100).toFixed(1)}%`;
}

/**
 * Get human-readable description of itemset
 * @param items Array of location names
 */
export function getItemsetDescription(items: string[]): string {
  if (items.length === 0) return 'Empty';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(' & ');
  
  const lastItem = items[items.length - 1];
  const otherItems = items.slice(0, -1).join(', ');
  return `${otherItems} & ${lastItem}`;
}
