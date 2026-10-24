// Full-screen title card for the demo video. Playwright navigates here between sections.
export default async function Card({ searchParams }: PageProps<"/demo/card">) {
  const { text, sub } = await searchParams;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 px-16 text-center text-white">
      <div className="mb-6 text-sm uppercase tracking-[0.3em] text-neutral-400">MediLink Health · CFAA demo · CO5159</div>
      <h1 className="text-6xl font-extrabold leading-tight">{typeof text === "string" ? text : ""}</h1>
      {typeof sub === "string" && <p className="mt-6 max-w-3xl text-2xl text-neutral-300">{sub}</p>}
    </div>
  );
}
