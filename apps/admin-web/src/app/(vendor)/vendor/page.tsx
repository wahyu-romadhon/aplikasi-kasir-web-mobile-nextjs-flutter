import { supabaseAdmin } from "@/lib/supabase/admin";
import { superAdminEmails } from "@/lib/superadmin";
import { CustomersView, type Customer } from "@/components/customers-view";

export default async function VendorPage() {
  const [{ data: stores }, { data: licenses }, { data: owners }, usersRes] =
    await Promise.all([
      supabaseAdmin.from("stores").select("id, name, created_at"),
      supabaseAdmin
        .from("licenses")
        .select("id, store_id, status, plan, valid_until, license_key"),
      supabaseAdmin.from("profiles").select("id, store_id, full_name").eq("role", "owner"),
      supabaseAdmin.auth.admin.listUsers(),
    ]);

  const emailById = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );
  const ownerByStore = new Map((owners ?? []).map((o) => [o.store_id, o]));
  const licenseByStore = new Map((licenses ?? []).map((l) => [l.store_id, l]));

  const vendorEmails = superAdminEmails();

  const customers: Customer[] = (stores ?? [])
    .map((s) => {
      const owner = ownerByStore.get(s.id);
      const lic = licenseByStore.get(s.id);
      const ownerEmail = owner ? emailById.get(owner.id) ?? "-" : "-";
      return {
        storeId: s.id,
        storeName: s.name,
        createdAt: s.created_at,
        ownerName: owner?.full_name ?? "-",
        ownerEmail,
        licenseId: lic?.id ?? null,
        status: lic?.status ?? null,
        plan: lic?.plan ?? null,
        validUntil: lic?.valid_until ?? null,
        licenseKey: lic?.license_key ?? null,
        isVendor: vendorEmails.includes(ownerEmail.toLowerCase()),
      };
    })
    .sort((a, b) => (a.validUntil ?? "") < (b.validUntil ?? "") ? -1 : 1);

  return <CustomersView initial={customers} />;
}
