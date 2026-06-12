import Link from "next/link";
import { Card } from "@/components/ui/card";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 block text-center font-display text-2xl font-extrabold"
        >
          Deal <span className="text-gold">Lomé</span>
        </Link>
        <Card glow>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </main>
  );
}

export function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="font-label text-sm font-medium text-ink-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-danger/40 bg-danger-deep/20 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}
