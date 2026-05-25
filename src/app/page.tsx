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
  Play,
  Route,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeliveryPlanner } from "@/components/delivery-planner/delivery-planner";

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

export default function Home() {
  const [activeRole, setActiveRole] = useState<keyof typeof roleTabs>("Dispatcher");

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <Image
          src="/ktm-bg.avif"
          alt=""
          fill
          priority
          className="object-cover opacity-[0.08]"
        />
        <div className="absolute inset-0 bg-white/90" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 lg:py-16">
          <div className="flex items-center gap-4">
            <Image
              src="/routesenselogo.png"
              alt="RouteSense"
              width={180}
              height={56}
              className="h-12 w-auto"
              priority
            />
            <span className="hidden h-8 w-px bg-slate-200 sm:block" />
            <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
              Delivery operations platform
            </p>
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-center">
            <div>
              <div className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                Live routing, assignment, and driver tracking
              </div>

              <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                RouteSense
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Plan routes, assign drivers, and track every stop from warehouse to doorstep in a single operational workspace.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 bg-rose-600 px-6 hover:bg-rose-700">
                  <Link href="/auth/signin">
                    <Play className="mr-2 h-4 w-4" />
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 border-slate-200 bg-white px-6 text-slate-900 hover:bg-slate-50">
                  <Link href="/auth/signup">Create account</Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  "Route planning built for dispatch",
                  "Live GPS visibility for drivers",
                  "Clean package handoff between teams",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-rose-600" />
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,.08)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Operational snapshot
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">Today&apos;s route control</p>
                </div>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                  LIVE
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <MiniStat label="Drivers on shift" value="18" />
                <MiniStat label="Packages queued" value="146" />
                <MiniStat label="Stops in transit" value="32" />
                <MiniStat label="Average delay" value="07 min" />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Route sequence</p>
                    <p className="text-xs text-slate-500">Warehouse to final stop</p>
                  </div>
                  <Route className="h-5 w-5 text-rose-600" />
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    "Warehouse collection confirmed",
                    "Stop 1 assigned to Driver A",
                    "Live GPS active on the route",
                  ].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl bg-white px-3 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-semibold text-rose-700">
                        {index + 1}
                      </span>
                      <span className="text-sm text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <CounterStat key={stat.label} {...stat} />
          ))}
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
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50"
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">
                {roleTabs[activeRole].title}
              </p>
              <div className="mt-4 space-y-3">
                {roleTabs[activeRole].points.map((point) => (
                  <div key={point} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <ShieldCheck className="h-4 w-4 text-rose-600" />
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
                  <Icon className="h-6 w-6 text-rose-600" />
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
            text="Use the embedded planner to test stop entry, optimization, live GPS, and route completion in one place."
          />
          <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <DeliveryPlanner />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-rose-200 bg-rose-50 p-8 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Get started</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                Ready to run deliveries with less guesswork?
              </h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                Start with the dispatcher or driver account and move from package creation to route execution in a few clicks.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 bg-rose-600 px-6 hover:bg-rose-700">
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
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
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">{eyebrow}</p>
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
    <div ref={ref} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-3xl font-bold text-slate-950">
        {formatted}
        {suffix}
      </div>
      <p className="mt-2 text-sm text-slate-600">{label}</p>
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
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-600 text-sm font-bold text-white">
          {number}
        </div>
        <Icon className="h-5 w-5 text-rose-600" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function RoleCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">{title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>
      <div className="mt-5 rounded-xl bg-white p-3">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Clock3 className="h-4 w-4 text-rose-600" />
          Ready for work
        </div>
      </div>
    </div>
  );
}
