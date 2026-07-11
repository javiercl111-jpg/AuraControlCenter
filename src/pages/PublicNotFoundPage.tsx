export default function PublicNotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 font-sans text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/50 p-10 text-center shadow-2xl backdrop-blur-md">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-3xl shadow-inner">
          🌌
        </div>
        
        <h1 className="mb-3 text-lg font-bold text-white tracking-tight">
          Aura Intelligence
        </h1>
        
        <p className="mb-8 text-sm text-slate-400 leading-relaxed">
          No pudimos encontrar este acceso. Es posible que la dirección sea incorrecta o el enlace haya expirado.
        </p>

        <a
          href="https://auranexus.io"
          className="inline-block w-full rounded-xl bg-cyan-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-cyan-500 active:scale-95"
        >
          Volver a Aura Nexus
        </a>
      </div>
    </div>
  );
}
