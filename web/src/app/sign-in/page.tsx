import Link from "next/link";

import { signInWithPassword } from "@/lib/auth/actions";

function getMessage(input: string | undefined) {
  if (input === "check_email") return "Check your email for verification instructions.";
  if (input === "signed_out") return "You have been signed out.";
  if (input === "password_updated") return "Password updated. You can now sign in.";
  if (input === "provider_pending") {
    return "Provider registration submitted. Login after admin approval.";
  }
  return null;
}

function getError(input: string | undefined) {
  if (input === "invalid_form") return "Please provide a valid email and password.";
  if (input === "invalid_credentials") return "Invalid email or password.";
  if (input === "invite_requires_login") {
    return "Please sign in before accepting your invitation.";
  }
  return null;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next ?? "";
  const message = getMessage(params.message);
  const error = getError(params.error);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Sign In</h1>
      <p className="mt-2 text-sm text-slate-600">
        Access your virtual care workspace securely.
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
      <form action={signInWithPassword} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={nextPath} />
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
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Sign in
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-slate-600 hover:text-slate-900">
          Forgot password?
        </Link>
        <Link href="/sign-up" className="text-slate-600 hover:text-slate-900">
          Create account
        </Link>
      </div>
    </div>
  );
}
