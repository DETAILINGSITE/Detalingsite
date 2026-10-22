import { desc } from "drizzle-orm";
import { connection } from "next/server";
import { ActionForm, AdminCheck, AdminInput, AdminSelect } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { formatMoney } from "@/lib/domain/money";
import { promoSaveAction } from "../actions";

export default async function PromosPage() {
  await connection();
  const promos = await getDb().select().from(s.promoCodes).orderBy(desc(s.promoCodes.createdAt));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Promo codes</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        {[...promos, undefined].map((p) => (
          <div key={p?.id ?? "new"} className="card p-4">
            {p && (
              <p className="mb-3 text-sm text-fg-muted">
                Used {p.redemptionCount}
                {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""} times · {p.kind === "percent" ? `${p.value}% off` : `${formatMoney(p.value)} off`}
              </p>
            )}
            <ActionForm action={promoSaveAction} submitLabel={p ? "Save" : "Create code"}>
              <div className="grid gap-3 sm:grid-cols-3">
                <AdminInput label="Code" name="code" defaultValue={p?.code} required />
                <AdminSelect label="Type" name="kind" defaultValue={p?.kind ?? "percent"} options={[{ value: "percent", label: "Percent off" }, { value: "fixed", label: "Dollars off" }]} />
                <AdminInput label="Value (% or $)" name="value" type="number" step="0.01" defaultValue={p ? (p.kind === "fixed" ? (p.value / 100).toFixed(2) : p.value) : ""} required />
                <AdminInput label="Max uses (blank = unlimited)" name="maxRedemptions" type="number" defaultValue={p?.maxRedemptions ?? ""} />
                <AdminInput label="Ends on" name="endsAt" type="date" defaultValue={p?.endsAt ? p.endsAt.toISOString().slice(0, 10) : ""} />
              </div>
              <div className="flex gap-4">
                <AdminCheck label="First booking only" name="firstBookingOnly" defaultChecked={p?.firstBookingOnly} />
                <AdminCheck label="Active" name="active" defaultChecked={p?.active ?? true} />
              </div>
            </ActionForm>
          </div>
        ))}
      </div>
    </div>
  );
}
