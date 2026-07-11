import { Card } from "@/components/ui/card";
import { getPlatformSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function AdminParametresPage() {
  const settings = await getPlatformSettings();

  const fixed = [
    { label: "Devise", value: "Franc CFA (XOF) uniquement" },
    { label: "Zone de livraison", value: "Lomé et environs (MVP)" },
    {
      label: "Paiements",
      value: "Mode démo (wallet simulé) - agrégateur Mobile Money à venir",
    },
    {
      label: "Emails",
      value: "Brevo (transactionnels de marque sur tout le cycle de vie)",
    },
  ];

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">
          Paramètres de la plateforme
        </h1>
        <p className="mt-1 text-ink-muted">
          Commission et frais appliqués aux transactions. Toute modification
          est journalisée.
        </p>
      </div>

      <Card>
        <h2 className="font-display text-lg font-bold">Tarification</h2>
        <div className="mt-4">
          <SettingsForm
            commissionRatePct={settings.commissionRatePct}
            deliveryFeeFcfa={settings.deliveryFeeFcfa}
          />
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold">Configuration fixe (MVP)</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {fixed.map((item) => (
            <li key={item.label} className="flex justify-between gap-4">
              <span className="text-ink-muted">{item.label}</span>
              <span className="text-right">{item.value}</span>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
