export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-8 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-3 h-9 w-72" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
        <div className="skeleton h-40" />
      </div>
    </div>
  );
}
