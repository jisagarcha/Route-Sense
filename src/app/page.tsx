"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Route,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteMap } from "@/components/route-map";

const stats = [
  { value: 12000, suffix: "+", label: "Deliveries Optimized" },
  { value: 98.3, suffix: "%", label: "On-Time Rate" },
  { value: 3.2, suffix: "x", label: "Faster Route Planning" },
  { value: 47, suffix: " min", label: "Avg Time Saved Per Driver/Day" },
];

const features = [
  {
    icon: Route,
    title: "Smart Route Optimization",
    text: "Calculate stop order from live road data and keep the route current when stops change.",
  },
  {
    icon: MapPin,
    title: "Map-Based Setup",
    text: "Set warehouse and delivery points directly on the map without managing coordinates by hand.",
  },
  {
    icon: Truck,
    title: "Live Driver Tracking",
    text: "Watch the active route on one map and keep dispatcher, warehouse, and driver views aligned.",
  },
  {
    icon: Package,
    title: "Package Lifecycle Control",
    text: "Track package assignment, pickup, transit, delivery, and failures in one flow.",
  },
  {
    icon: Zap,
    title: "Fallback Routing",
    text: "Generate workable routes even when the package data is incomplete and refine them later.",
  },
  {
    icon: BarChart3,
    title: "Role-Focused Dashboards",
    text: "Dispatcher, driver, and admin views stay separate so each team only sees what it needs.",
  },
];

const roleTabs = {
  Dispatcher: {
    title: "Route control",
    points: ["Package queue", "Driver assignment", "Road-aware ETAs"],
  },
  Driver: {
    title: "Live navigation",
    points: ["Current stop", "GPS position", "Delivery actions"],
  },
  Admin: {
    title: "Operations overview",
    points: ["Warehouses", "Routes", "System history"],
  },
} as const;

const demoStops = [
  {
    id: "demo-warehouse",
    lat: 27.7178,
    lng: 85.3242,
    label: "W1",
    address: "Warehouse W1 (Baluwatar)",
    status: "IN_TRANSIT",
  },
  {
    id: "demo-stop-1",
    lat: 27.7224,
    lng: 85.3321,
    label: "1",
    address: "Customer stop 1 (Panipokhari)",
    status: "PENDING",
  },
  {
    id: "demo-stop-2",
    lat: 27.7281,
    lng: 85.3404,
    label: "2",
    address: "Customer stop 2 (Dhumbarahi)",
    status: "PENDING",
  },
  {
    id: "demo-stop-3",
    lat: 27.7342,
    lng: 85.3461,
    label: "3",
    address: "Customer stop 3 (Mahankal)",
    status: "PENDING",
  },
];

// Street-following driving path coordinates through Kathmandu road network
const demoStreetPolyline: Array<[number, number]> = [
  [27.7178, 85.3242], // W1 Baluwatar
  [27.7188, 85.3256],
  [27.7198, 85.3278],
  [27.7210, 85.3302],
  [27.7224, 85.3321], // Stop 1 (Panipokhari)
  [27.7236, 85.3342],
  [27.7252, 85.3370],
  [27.7268, 85.3388],
  [27.7276, 85.3399],
  [27.7281, 85.3404], // Stop 2 (Dhumbarahi)
  [27.7292, 85.3418],
  [27.7308, 85.3432],
  [27.7322, 85.3446],
  [27.7335, 85.3455],
  [27.7342, 85.3461], // Stop 3 (Mahankal)
];

export default function Home() {
  const [activeRole, setActiveRole] = useState<keyof typeof roleTabs>("Dispatcher");
  const [demoRoadPolyline, setDemoRoadPolyline] = useState<Array<[number, number]>>(demoStreetPolyline);

  useEffect(() => {
    async function loadRoadGeometry() {
      try {
        const res = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: demoStops.map((s) => ({ lat: s.lat, lng: s.lng })),
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const coords = data.route?.coordinates;
        if (Array.isArray(coords) && coords.length > 1) {
          setDemoRoadPolyline(coords);
        }
      } catch (err) {
        console.warn("Using street polyline fallback for demo:", err);
      }
    }
    void loadRoadGeometry();
  }, []);

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 min-h-[92vh] flex flex-col justify-between">
        {/* Background Artwork */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/ktm-hero.jpg"
            alt="Kathmandu Durbar Square Background"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          {/* Luminous left-side gradient overlay for high contrast text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/70 to-white/10 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-white/80 pointer-events-none" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 pt-8 pb-12 lg:pt-12 lg:pb-16">
          {/* Brand Eyebrow Badge */}
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2.5 rounded-full bg-white/85 backdrop-blur-md border border-white/70 px-3.5 py-1.5 shadow-xs">
              <Image
                src="/routesenselogo.png"
                alt="RouteSense"
                width={110}
                height={32}
                className="h-5 w-auto"
                priority
              />
              <span className="h-3.5 w-px bg-slate-300" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#65000B]">
                Delivery operations platform
              </p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(400px,0.85fr)] lg:items-center">
            {/* Left Column */}
            <div>
              <div className="inline-flex items-center rounded-full border border-[#65000B]/25 bg-[#65000B]/10 backdrop-blur-md px-4 py-1.5 text-xs sm:text-sm font-semibold text-[#65000B] shadow-xs">
                Live routing, assignment, and driver tracking
              </div>

              <h1 className="mt-5 max-w-3xl text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl drop-shadow-xs">
                RouteSense
              </h1>

              <p className="mt-4 max-w-xl text-base sm:text-lg font-medium leading-relaxed text-slate-800 drop-shadow-xs">
                Plan routes, assign drivers, and track every stop from warehouse to doorstep in a single operational workspace.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 bg-[#65000B] px-8 font-semibold text-white shadow-md hover:bg-[#4d0008] hover:shadow-lg transition">
                  <Link href="/auth/signin" className="text-white font-semibold flex items-center justify-center">
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 border-white/80 bg-white/85 backdrop-blur-md px-6 font-semibold text-slate-800 shadow-sm hover:bg-white transition">
                  <Link href="/auth/signup">Create account</Link>
                </Button>
              </div>

              {/* 3 Frosted Feature Cards */}
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  { text: "Route planning built for dispatch", icon: CheckCircle2 },
                  { text: "Live GPS visibility for drivers", icon: CheckCircle2 },
                  { text: "Clean package handoff between teams", icon: Clock3 },
                ].map(({ text, icon: Icon }) => (
                  <div key={text} className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-4 shadow-sm transition hover:bg-white/95">
                    <Icon className="h-5 w-5 text-[#65000B]" />
                    <p className="mt-2.5 text-xs sm:text-sm font-semibold leading-snug text-slate-800">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Frosted Operational Snapshot Card */}
            <div className="rounded-3xl border border-white/80 bg-white/85 backdrop-blur-xl p-6 shadow-2xl shadow-slate-900/10">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100/80">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    OPERATIONAL SNAPSHOT
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-slate-950">Today&apos;s route control</p>
                </div>
                <span className="rounded-full bg-[#65000B]/10 px-2.5 py-1 text-xs font-bold text-[#65000B] tracking-wide">
                  LIVE
                </span>
              </div>

              {/* 2x2 Stats Grid */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm p-3.5 shadow-2xs">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">DRIVERS ON SHIFT</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-950">18</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm p-3.5 shadow-2xs">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">PACKAGES QUEUED</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-950">146</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm p-3.5 shadow-2xs">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">STOPS IN TRANSIT</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-950">32</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm p-3.5 shadow-2xs">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">AVERAGE DELAY</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-950">07 min</p>
                </div>
              </div>

              {/* Route Sequence Subcard */}
              <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 backdrop-blur-sm p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-950">Route sequence</p>
                    <p className="text-xs text-slate-500">Warehouse to final stop</p>
                  </div>
                  <Route className="h-4 w-4 text-[#65000B]" />
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    { badge: "W1", text: "Warehouse collection confirmed" },
                    { badge: "1", text: "Stop 1 assigned to Driver A" },
                    { badge: "2", text: "Stop 2 - Live GPS active on the route" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/90 px-3 py-2.5 shadow-2xs">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#65000B] text-xs font-bold text-white shadow-2xs">
                        {item.badge}
                      </span>
                      <span className="text-xs sm:text-sm font-medium text-slate-800">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating Frosted Stats Strip */}
          <div className="mt-12 rounded-3xl border border-white/80 bg-white/85 backdrop-blur-md p-4 sm:p-6 shadow-xl">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stats.map((stat) => (
                <CounterStat key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="How it works"
            title="One operating loop from warehouse to doorstep"
            text="RouteSense keeps the dispatch, driver, and package views connected so handoffs stay clear throughout the day."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <StepCard
              icon={Building2}
              number="1"
              title="Admin prepares the network"
              text="Warehouses, roads, and operational data stay ready before dispatch starts assigning work."
            />
            <StepCard
              icon={Route}
              number="2"
              title="Dispatcher builds the route"
              text="Packages are optimized, assigned, and sequenced in one control surface."
            />
            <StepCard
              icon={Truck}
              number="3"
              title="Driver follows the live route"
              text="The delivery screen keeps GPS, active stop, and status controls in view."
            />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Role preview"
            title="Focused screens for every operator"
            text="Each role gets a tighter view with the tools needed for that part of the day."
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {(Object.keys(roleTabs) as Array<keyof typeof roleTabs>).map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`h-11 rounded-md border px-5 text-sm font-semibold transition ${
                  activeRole === role
                    ? "border-[#65000B] bg-[#65000B] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#65000B]/30 hover:bg-[#65000B]/5"
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#65000B]">
                {roleTabs[activeRole].title}
              </p>
              <div className="mt-4 space-y-3">
                {roleTabs[activeRole].points.map((point) => (
                  <div key={point} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <ShieldCheck className="h-4 w-4 text-[#65000B]" />
                    <span className="text-sm text-slate-700">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-3">
                <RoleCard title="Warehouse" subtitle="Receive and stage packages" />
                <RoleCard title="Dispatch" subtitle="Optimize and assign routes" />
                <RoleCard title="Driver" subtitle="Navigate the live route" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Core system"
            title="Everything dispatch needs when the day changes fast"
            text="The application is tuned for scanning, assignment, and route control rather than decorative browsing."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <Icon className="h-6 w-6 text-[#65000B]" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{feature.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="demo" className="border-y border-slate-200 bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Interactive demo"
            title="Plan a live delivery route"
            text="Use the route preview to inspect stop order, live map state, and the driver handoff without taking over the whole page."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route preview</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">Warehouse to stop chain</p>
                </div>
                <span className="rounded-full bg-[#65000B]/10 px-3 py-1 text-xs font-semibold text-[#65000B]">
                  4 stops
                </span>
              </div>
              <div className="h-[520px]">
                <RouteMap
                  locations={[]}
                  stops={demoStops}
                  polyline={demoRoadPolyline}
                  center={[27.726, 85.335]}
                  zoom={13}
                  height="100%"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#65000B]">Dispatcher view</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">One route, one control point</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The preview stays compact on the page while still showing the warehouse, ordered stops, and route line.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-3">
                  <PreviewRow label="Pickup" value="Warehouse confirmed" />
                  <PreviewRow label="Stop order" value="3 customer deliveries" />
                  <PreviewRow label="Driver state" value="Ready to start" />
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-[#65000B]/5 p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#65000B]">Color system</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  White surfaces, slate text, and rich oxblood accents keep the page aligned with the brand without turning the interface heavy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[#65000B]/20 bg-[#65000B]/5 p-8 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#65000B]">Get started</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                Ready to run deliveries with less guesswork?
              </h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                Start with the dispatcher or driver account and move from package creation to route execution in a few clicks.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 bg-[#65000B] px-6 hover:bg-[#4d0008]">
                <Link href="/auth/signin">Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 border-slate-200 bg-white px-6 text-slate-900 hover:bg-slate-50">
                <Link href="/auth/signup">Create account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#65000B]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-7 text-slate-600">{text}</p>}
    </div>
  );
}

function CounterStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        const start = performance.now();
        const duration = 1200;

        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          setCount(value * progress);
          if (progress < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  const formatted = value % 1 === 0 ? Math.round(count).toLocaleString() : count.toFixed(1);

  return (
    <div ref={ref} className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm p-4 sm:p-5 shadow-2xs transition hover:bg-white/90">
      <div className="text-2xl sm:text-3xl font-extrabold text-slate-950">
        {formatted}
        {suffix}
      </div>
      <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function StepCard({
  icon: Icon,
  number,
  title,
  text,
}: {
  icon: LucideIcon;
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#65000B] text-sm font-bold text-white">
          {number}
        </div>
        <Icon className="h-5 w-5 text-[#65000B]" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function RoleCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#65000B]">{title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>
      <div className="mt-5 rounded-xl bg-white p-3">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Clock3 className="h-4 w-4 text-[#65000B]" />
          Ready for work
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}
