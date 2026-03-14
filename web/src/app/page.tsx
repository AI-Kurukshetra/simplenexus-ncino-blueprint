import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-sky-50 to-emerald-50 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-start justify-center px-6 py-16">
        <p className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium tracking-wide text-slate-600">
          Stage 1 Foundation Ready
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Next.js + Supabase scaffold for the Virtual Health Platform
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          Environment validation, Supabase clients, session middleware, and
          role-based route shells are now in place for patient, provider, and
          admin workflows.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app/patient/dashboard"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Open Patient Dashboard
          </Link>
          <Link
            href="/app/provider/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Open Provider Dashboard
          </Link>
          <Link
            href="/app/admin/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Open Admin Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
