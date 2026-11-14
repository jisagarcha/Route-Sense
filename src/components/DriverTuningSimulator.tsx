"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sliders, RotateCcw, Truck, Award, ShieldAlert, Sparkles } from "lucide-react";

interface Driver {
  id: string;
  name: string | null;
  email: string;
  profile?: {
    vehicleType?: string | null;
    maxCapacity?: number | null;
    maxVolume?: number | null;
    experienceYears?: number | null;
    rating?: number | null;
    totalDeliveries?: number | null;
    isAvailable?: boolean | null;
  } | null;
}

export function DriverTuningSimulator() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Weights (normalized to percentages)
  const [wCapacity, setWCapacity] = useState(40);
  const [wRating, setWRating] = useState(25);
  const [wExperience, setWExperience] = useState(15);
  const [wDistance, setWDistance] = useState(20);

  // Sample Package Simulation Attributes
  const [pkgWeight, setPkgWeight] = useState(15);
  const [pkgVolume, setPkgVolume] = useState(4);
  const [pkgDistance, setPkgDistance] = useState(12);
  const [pkgIsCritical, setPkgIsCritical] = useState(false);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/drivers");
      const data = await res.json();
      setDrivers(data.drivers || []);
    } catch (err) {
      console.error("Failed to fetch drivers for simulator:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetWeights = () => {
    setWCapacity(40);
    setWRating(25);
    setWExperience(15);
    setWDistance(20);
  };

  const scoredDrivers = useMemo(() => {
    const totalWeightSum = Math.max(1, wCapacity + wRating + wExperience + wDistance);
    const nwCapacity = wCapacity / totalWeightSum;
    const nwRating = wRating / totalWeightSum;
    const nwExperience = wExperience / totalWeightSum;
    const nwDistance = wDistance / totalWeightSum;

    return drivers.map((driver) => {
      const p = driver.profile || {};
      const maxCap = p.maxCapacity || 50;
      const maxVol = p.maxVolume || 20;
      const rating = p.rating || 4.5;
      const expYears = p.experienceYears || 2;
      const vehicle = (p.vehicleType || "2-wheeler").toLowerCase();

      // 1. Capacity Fit (ideal ratio 60-80%)
      const weightUtil = pkgWeight / Math.max(1, maxCap);
      const volumeUtil = pkgVolume / Math.max(1, maxVol);
      const weightFit = Math.max(0, 1 - Math.abs(weightUtil - 0.7));
      const volumeFit = Math.max(0, 1 - Math.abs(volumeUtil - 0.7));
      const capacityScore = weightFit * 0.6 + volumeFit * 0.4;

      // 2. Rating Score (0 to 1)
      const ratingScore = Math.min(Math.max(rating / 5, 0), 1);

      // 3. Experience Score (0 to 1, capped at 10 years)
      const experienceScore = Math.min(Math.max(expYears / 10, 0), 1);

      // 4. Vehicle Distance Suitability
      let vehicleScore = 0.8;
      if (vehicle.includes("2-wheeler") || vehicle.includes("bike")) {
        vehicleScore = pkgDistance <= 15 ? 1.0 : 0.55;
      } else if (vehicle.includes("van") || vehicle.includes("car")) {
        vehicleScore = pkgDistance <= 35 ? 0.95 : 0.8;
      } else if (vehicle.includes("truck")) {
        vehicleScore = pkgDistance > 10 ? 1.0 : 0.65;
      }

      // Critical Package Multiplier
      let composite = 0;
      if (pkgIsCritical) {
        composite =
          capacityScore * (nwCapacity * 0.7) +
          ratingScore * (nwRating * 1.4) +
          experienceScore * (nwExperience * 1.4) +
          vehicleScore * nwDistance;
      } else {
        composite =
          capacityScore * nwCapacity +
          ratingScore * nwRating +
          experienceScore * nwExperience +
          vehicleScore * nwDistance;
      }

      const scoreOutOf100 = Math.min(
        100,
        Math.round((50 + composite * 45 + (p.isAvailable ? 5 : 0)) * 10) / 10
      );

      return {
        id: driver.id,
        name: driver.name || driver.email,
        vehicleType: p.vehicleType || "Unspecified",
        rating,
        experienceYears: expYears,
        isAvailable: p.isAvailable ?? true,
        score: scoreOutOf100,
        subScores: {
          capacity: Math.round(capacityScore * 100),
          rating: Math.round(ratingScore * 100),
          experience: Math.round(experienceScore * 100),
          vehicle: Math.round(vehicleScore * 100),
        },
      };
    }).sort((a, b) => b.score - a.score);
  }, [drivers, wCapacity, wRating, wExperience, wDistance, pkgWeight, pkgVolume, pkgDistance, pkgIsCritical]);

  return (
    <Card className="border-blue-100 shadow-sm">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sliders className="h-5 w-5 text-blue-600" />
              Driver Matching Weight Tuning & Simulator
            </CardTitle>
            <CardDescription>
              Fine-tune the Multi-Criteria Decision Making (MCDM) weights to optimize fleet efficiency.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetWeights} className="text-xs self-start">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Defaults
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sliders Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span>Capacity Fit ({wCapacity}%)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={wCapacity}
              onChange={(e) => setWCapacity(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Weight & volume efficiency</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span>Driver Rating ({wRating}%)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={wRating}
              onChange={(e) => setWRating(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Customer feedback score</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span>Experience ({wExperience}%)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={wExperience}
              onChange={(e) => setWExperience(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Years on the road</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span>Vehicle Fit ({wDistance}%)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={wDistance}
              onChange={(e) => setWDistance(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Bike vs. Van vs. Truck distance match</p>
          </div>
        </div>

        {/* Simulation Scenario Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs">
          <div>
            <Label className="text-[11px] text-slate-600">Simulated Weight (kg)</Label>
            <Input
              type="number"
              value={pkgWeight}
              onChange={(e) => setPkgWeight(Number(e.target.value))}
              className="h-8 text-xs mt-1 bg-white"
            />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600">Simulated Volume (cu ft)</Label>
            <Input
              type="number"
              value={pkgVolume}
              onChange={(e) => setPkgVolume(Number(e.target.value))}
              className="h-8 text-xs mt-1 bg-white"
            />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600">Route Distance (km)</Label>
            <Input
              type="number"
              value={pkgDistance}
              onChange={(e) => setPkgDistance(Number(e.target.value))}
              className="h-8 text-xs mt-1 bg-white"
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer pb-1.5">
              <input
                type="checkbox"
                checked={pkgIsCritical}
                onChange={(e) => setPkgIsCritical(e.target.checked)}
                className="h-4 w-4 rounded accent-red-600"
              />
              <span className="font-semibold text-red-700 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Critical Cargo
              </span>
            </label>
          </div>
        </div>

        {/* Ranked Drivers Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Simulated Algorithm Driver Ranking</span>
            <span>{scoredDrivers.length} active drivers evaluated</span>
          </div>

          {loading ? (
            <p className="text-center text-xs text-slate-500 py-4">Evaluating fleet...</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white">
              {scoredDrivers.slice(0, 5).map((d, index) => (
                <div key={d.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                        {d.name}
                        {index === 0 && (
                          <Badge className="bg-emerald-600 text-[10px] py-0 px-1.5">
                            <Sparkles className="h-3 w-3 mr-0.5" /> Top Match
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {d.vehicleType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3" /> {d.rating} ★
                        </span>
                        <span>{d.experienceYears} yrs exp</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold text-blue-700">{d.score} pts</div>
                    <div className="text-[11px] text-slate-400">
                      Cap: {d.subScores.capacity}% • Rating: {d.subScores.rating}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
