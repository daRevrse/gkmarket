export function LegalTitle({
  children,
  updated,
}: {
  children: React.ReactNode;
  updated?: string;
}) {
  return (
    <header className="mb-8 border-b border-white/[0.06] pb-6">
      <h1 className="font-display text-3xl font-extrabold">{children}</h1>
      {updated ? (
        <p className="mt-2 text-sm text-ink-muted">
          Dernière mise à jour : {updated}
        </p>
      ) : null}
    </header>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 font-display text-lg font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-muted">
        {children}
      </div>
    </section>
  );
}
