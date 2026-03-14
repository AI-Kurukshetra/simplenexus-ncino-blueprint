import Link from "next/link";

function statusCopy(state: string | undefined) {
  if (state === "rejected") {
    return {
      title: "Provider Access Not Approved",
      message:
        "Your provider account was reviewed and is currently not approved. Contact your organization admin for next steps.",
      color: "rose",
    };
  }

  return {
    title: "Provider Approval Pending",
    message:
      "Your provider account is waiting for admin verification. You can access provider workflows after approval.",
    color: "amber",
  };
}

export default async function ProviderPendingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const copy = statusCopy(state);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{copy.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">{copy.message}</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/sign-in"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Refresh Status
        </Link>
        <Link
          href="/app/unauthorized"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
        >
          View Access Info
        </Link>
      </div>
    </div>
  );
}
