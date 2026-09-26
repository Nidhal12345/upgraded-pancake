import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="font-serif text-[56px] leading-none text-fg-4">404</p>
        <h1 className="mt-3 text-[17px] font-semibold">This page drifted off the calendar</h1>
        <p className="mt-1 text-[13.5px] text-fg-3">The link may be old, or the page never existed.</p>
        <Link href="/today" className="mt-5 inline-flex h-8 items-center rounded-[8px] bg-accent px-3 text-[13px] font-medium text-accent-fg">
          Back to Today
        </Link>
      </div>
    </div>
  );
}
