import Link from "next/link";

import { signUpWithPassword } from "@/lib/auth/actions";

function getError(input: string | undefined) {
  if (input === "invalid_form") {
    return "Please fill all required fields. Provider signup needs specialty and license number.";
  }
  if (input === "signup_failed") return "Unable to create account right now.";
  return null;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = getError(params.error);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-cyan-50 to-emerald-100 px-6 py-12">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-lg backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Create Account
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose your role. Providers require admin approval before serving patients.
        </p>
      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
        <form action={signUpWithPassword} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="fullName" className="text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="phone" className="text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Sign up as</legend>
            <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <input type="radio" name="role" value="patient" defaultChecked />
              <span className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">Patient</span>
                <br />
                Can request appointments and access personal care portal.
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <input type="radio" name="role" value="provider" />
              <span className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">Provider</span>
                <br />
                Requires admin verification and approval before practice access.
              </span>
            </label>
          </fieldset>
          <section className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <h2 className="text-sm font-medium text-slate-900">Provider Verification Details</h2>
            <p className="text-xs text-slate-600">
              Required only if signing up as provider. Admin reviews these before approval.
            </p>
            <div className="space-y-1">
              <label htmlFor="providerSpecialty" className="text-sm font-medium text-slate-700">
                Specialty
              </label>
              <input
                id="providerSpecialty"
                name="providerSpecialty"
                type="text"
                placeholder="Family Medicine"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="providerLicenseNumber"
                className="text-sm font-medium text-slate-700"
              >
                License Number
              </label>
              <input
                id="providerLicenseNumber"
                name="providerLicenseNumber"
                type="text"
                placeholder="LIC-123456"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="providerYearsExperience"
                className="text-sm font-medium text-slate-700"
              >
                Years of Experience
              </label>
              <input
                id="providerYearsExperience"
                name="providerYearsExperience"
                type="text"
                placeholder="8"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-cyan-200 focus:ring-2"
              />
            </div>
          </section>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Create account
          </button>
        </form>
        <Link
          href="/sign-in"
          className="mt-4 inline-flex w-fit text-sm text-slate-600 hover:text-slate-900"
        >
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  );
}
