import Link from "next/link";

import { acceptInvite } from "@/lib/auth/actions";

function getError(input: string | undefined) {
  if (input === "invalid_code") return "Enter a valid invitation code.";
  if (input === "accept_failed") return "Unable to accept invitation. Try again.";
  return null;
}

export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = getError(params.error);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Accept Invitation</h1>
      <p className="mt-2 text-sm text-slate-600">
        Paste your invite code to apply role and organization access.
      </p>
      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <form action={acceptInvite} className="mt-6 space-y-3">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Invite Code</span>
          <input
            name="inviteCode"
            required
            placeholder="pro_abcd1234"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Accept invitation
        </button>
      </form>
      <Link
        href="/sign-in?next=/invite/accept"
        className="mt-4 inline-flex text-sm text-slate-600 hover:text-slate-900"
      >
        Sign in first if needed
      </Link>
    </div>
  );
}
