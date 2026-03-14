import Link from "next/link";

import { signOut } from "@/lib/auth/actions";
import {
  getProviderApprovalStatus,
  getRoleFromUser,
  isProviderPendingApproval,
} from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getNavItems(role: string | null, providerPending: boolean) {
  if (role === "patient") {
    return [
      { href: "/app/patient/dashboard", label: "Dashboard" },
      { href: "/app/patient/onboarding", label: "Onboarding" },
      { href: "/app/patient/appointments", label: "Appointments" },
      { href: "/app/patient/care-plans", label: "Care Plans" },
      { href: "/app/patient/billing", label: "Billing" },
      { href: "/app/patient/messages", label: "Messages" },
    ];
  }
  if (role === "provider") {
    if (providerPending) {
      return [{ href: "/app/provider/pending-approval", label: "Approval Status" }];
    }
    return [
      { href: "/app/provider/dashboard", label: "Dashboard" },
      { href: "/app/provider/schedule", label: "Schedule" },
      { href: "/app/provider/tasks", label: "Tasks" },
      { href: "/app/provider/messages", label: "Messages" },
    ];
  }
  if (role === "admin" || role === "super_admin") {
    return [
      { href: "/app/admin/dashboard", label: "Dashboard" },
      { href: "/app/admin/patients", label: "Patients" },
      { href: "/app/admin/workflows", label: "Workflows" },
      { href: "/app/admin/scheduling", label: "Scheduling" },
      { href: "/app/admin/appointments", label: "Appointments" },
      { href: "/app/admin/billing", label: "Billing" },
      { href: "/app/admin/claims", label: "Claims" },
      { href: "/app/admin/providers", label: "Providers" },
      { href: "/app/admin/audit", label: "Audit" },
      { href: "/app/admin/messages", label: "Messages" },
    ];
  }
  return [{ href: "/app", label: "Home" }];
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = getRoleFromUser(user);
  const providerPending = isProviderPendingApproval(user);
  const navItems = getNavItems(role, providerPending);
  const roleLabel =
    role === "provider" && providerPending
      ? `provider (${getProviderApprovalStatus(user) ?? "pending"})`
      : role ?? "guest";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-sky-50 to-emerald-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-semibold text-slate-900">
            Virtual Health Platform
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {roleLabel}
            </span>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-white transition hover:bg-slate-700"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
