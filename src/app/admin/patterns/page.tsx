'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FrequentItemset {
  locations: string[];
  description: string;
  support: number;
  supportPercentage: string;
  count: number;
  size: number;
}

interface PatternsResult {
  frequentItemsets: FrequentItemset[];
  minSupport: number;
  totalTransactions: number;
  algorithm: {
    name: string;
    complexity: string;
    description: string;
  };
}

export default function PatternsPage() {
  const [minSupport, setMinSupport] = useState('0.3');
  const [minItemsetSize, setMinItemsetSize] = useState('2');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PatternsResult | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const params = new URLSearchParams({
        minSupport,
        minItemsetSize,
      });

      const response = await fetch(`/api/patterns?${params}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to run pattern mining');
        return;
      }

      setResult(data);
    } catch (err) {
      setError('An error occurred while analyzing patterns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">📊 Pattern Analytics</h1>
        <p className="text-muted-foreground">
          Discover frequent location patterns using the Apriori Algorithm
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configure Pattern Mining</CardTitle>
          <CardDescription>
            Set parameters for the Apriori algorithm
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <Label htmlFor="minSupport">Minimum Support (0-1)</Label>
              <Input
                id="minSupport"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={minSupport}
                onChange={(e) => setMinSupport(e.target.value)}
                placeholder="e.g., 0.3"
              />
              <p className="text-xs text-muted-foreground">
                Minimum frequency for a pattern to be considered significant (30% = 0.3)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minItemsetSize">Minimum Pattern Size</Label>
              <Input
                id="minItemsetSize"
                type="number"
                min="1"
                value={minItemsetSize}
                onChange={(e) => setMinItemsetSize(e.target.value)}
                placeholder="e.g., 2"
              />
              <p className="text-xs text-muted-foreground">
                Minimum number of locations in a pattern (2 = pairs, 3 = triplets, etc.)
              </p>
            </div>
          </div>

          <Button onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analyzing...' : '🔍 Analyze Patterns'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
              <CardDescription>
                {result.algorithm.name} - {result.algorithm.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total Routes Analyzed</p>
                  <p className="text-2xl font-bold">{result.totalTransactions}</p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Patterns Found</p>
                  <p className="text-2xl font-bold">{result.frequentItemsets.length}</p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Min Support</p>
                  <p className="text-2xl font-bold">{(result.minSupport * 100).toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frequent Location Patterns</CardTitle>
              <CardDescription>
                Common combinations of locations that appear together in routes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.frequentItemsets.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No frequent patterns found with the current support threshold. 
                    Try lowering the minimum support value.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Locations</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Support</TableHead>
                      <TableHead>Frequency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.frequentItemsets.map((itemset, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          Pattern #{index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {itemset.locations.map((loc, i) => (
                              <span
                                key={i}
                                className="bg-primary/10 text-primary px-2 py-1 rounded text-sm"
                              >
                                {loc}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{itemset.size}</TableCell>
                        <TableCell>
                          <span className="font-bold">{itemset.supportPercentage}</span>
                        </TableCell>
                        <TableCell>
                          {itemset.count} / {result.totalTransactions} routes
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Algorithm Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Algorithm:</span> {result.algorithm.name}</p>
                <p><span className="font-semibold">Complexity:</span> {result.algorithm.complexity}</p>
                <p><span className="font-semibold">Purpose:</span> {result.algorithm.description}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
