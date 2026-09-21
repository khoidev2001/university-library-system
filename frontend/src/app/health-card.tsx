"use client";

import { useEffect, useState } from "react";

type Health = { status?: string; service?: string; database?: string; error?: string };

const SERVICES: { name: string; path: string }[] = [
  { name: "Backend API", path: "/api/health" },
  { name: "AI Service", path: "/ai/health" },
];

export function HealthCard() {
  const [results, setResults] = useState<Record<string, Health>>({});

  useEffect(() => {
    SERVICES.forEach(({ name, path }) => {
      fetch(path)
        .then((r) => r.json())
        .then((body: Health) => setResults((prev) => ({ ...prev, [name]: body })))
        .catch((e: Error) => setResults((prev) => ({ ...prev, [name]: { error: e.message } })));
    });
  }, []);

  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      <li className="rounded-xl border border-zinc-200 p-4">
        <p className="font-semibold">Frontend</p>
        <p className="text-emerald-700">ok</p>
      </li>
      {SERVICES.map(({ name }) => {
        const r = results[name];
        const ok = r?.status === "ok";
        return (
          <li key={name} className="rounded-xl border border-zinc-200 p-4">
            <p className="font-semibold">{name}</p>
            <p className={ok ? "text-emerald-700" : "text-amber-600"}>
              {r ? (r.status ?? r.error) : "đang kiểm tra…"}
              {r?.database ? ` · db: ${r.database}` : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
