/** Stempel merah samar (TRIAL / DEMO) menutupi layar. */
export function TrialWatermark({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
    >
      <div
        className="rotate-[-20deg] rounded-2xl border-4 border-danger px-12 py-5 text-7xl font-black uppercase tracking-[0.2em] text-danger"
        style={{ opacity: 0.1 }}
      >
        {label}
      </div>
    </div>
  );
}
