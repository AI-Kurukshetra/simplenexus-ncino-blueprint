import { updatePassword } from "@/lib/auth/actions";

function getError(input: string | undefined) {
  if (input === "password_mismatch") return "Passwords must match and be at least 8 characters.";
  if (input === "update_failed") return "Unable to update password. Request a new reset link.";
  return null;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = getError(params.error);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Reset Password</h1>
      <p className="mt-2 text-sm text-slate-600">
        Set a new password for your account.
      </p>
      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <form action={updatePassword} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            New password
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
        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
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
          Update password
        </button>
      </form>
    </div>
  );
}
