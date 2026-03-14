import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-xl font-semibold text-amber-900">Access Restricted</h1>
      <p className="mt-2 text-sm leading-6 text-amber-800">
        You are signed in, but your current role does not allow access to this
        area.
      </p>
      <Link
        href="/app"
        className="mt-4 inline-flex rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
      >
        Go to allowed dashboard
      </Link>
    </div>
  );
}
