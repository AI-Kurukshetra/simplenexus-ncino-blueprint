import Link from "next/link";

import { requestPasswordReset } from "@/lib/auth/actions";

function getMessage(input: string | undefined) {
  if (input === "check_email") return "Reset instructions sent to your email.";
  return null;
}

function getError(input: string | undefined) {
  if (input === "invalid_email") return "Please enter a valid email address.";
  if (input === "request_failed") return "Unable to process request right now.";
  return null;
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const message = getMessage(params.message);
  const error = getError(params.error);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Forgot Password</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your email to receive a password reset link.
      </p>
      {message ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <form action={requestPasswordReset} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Send reset link
        </button>
      </form>
      <Link href="/sign-in" className="mt-4 inline-flex text-sm text-slate-600 hover:text-slate-900">
        Back to sign in
      </Link>
    </div>
  );
}
