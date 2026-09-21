import { HealthCard } from "./health-card";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
          Đề tài 8 · Công nghệ Phần mềm
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          Hệ thống Quản lý Thư viện Trường Đại học
        </h1>
        <p className="text-lg text-zinc-600">
          Sprint 0 — khung mã nguồn. Trạng thái các dịch vụ:
        </p>
      </header>
      <HealthCard />
    </main>
  );
}
