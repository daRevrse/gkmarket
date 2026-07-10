import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export default async function ProfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const seller = user.sellerProfile;

  return (
    <main className="flex-1">
      <Link
        href="/compte"
        className="font-label text-sm text-ink-muted hover:text-emerald"
      >
        ‹ Aperçu
      </Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Mon profil</h1>
      <p className="mt-1 text-ink-muted">
        Mettez à jour vos informations
        {seller ? " et celles de votre boutique" : ""}.
      </p>

      <div className="mt-8 max-w-2xl">
        <ProfileForm
          fullName={user.fullName ?? ""}
          email={user.email}
          phone={user.phone}
          shop={
            seller
              ? {
                  shopName: seller.shopName,
                  shopDescription: seller.shopDescription ?? "",
                  city: seller.city,
                  district: seller.district ?? "",
                  contactPhone: seller.contactPhone ?? "",
                  sellingConditions: seller.sellingConditions ?? "",
                  payoutMethod:
                    (seller.payoutMethod as "" | "mobile_money" | "bank") ?? "",
                  mobileMoneyOperator:
                    (seller.mobileMoneyOperator as "" | "flooz" | "tmoney") ??
                    "",
                  mobileMoneyNumber: seller.mobileMoneyNumber ?? "",
                  bankName: seller.bankName ?? "",
                  bankAccountName: seller.bankAccountName ?? "",
                  bankIban: seller.bankIban ?? "",
                  logoUrl: seller.logoUrl,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
