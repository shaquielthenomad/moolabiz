export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-amber-50 text-neutral-800">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
        MoolaBiz Bot
      </h1>
      <p className="flex items-center gap-2 text-lg">
        <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
        Running
      </p>
      <p className="text-sm text-neutral-500">Powered by MoolaBiz</p>
    </main>
  );
}
