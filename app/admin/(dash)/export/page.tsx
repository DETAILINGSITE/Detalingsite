import { connection } from "next/server";
import { requireAdminPage } from "@/lib/server/admin-guard";

const EXPORTS = [
  { type: "bookings", label: "Bookings", body: "Every booking with customer, vehicle, location, totals and status." },
  { type: "customers", label: "Customers", body: "Contact details, consent and booking counts." },
  { type: "leads", label: "Leads", body: "Enquiries, abandoned bookings and their sources." },
  { type: "payments", label: "Payments", body: "Deposits, balances and refunds for bookkeeping." },
];

export default async function ExportPage() {
  await connection();
  await requireAdminPage({ role: "owner" });
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Export</h1>
      <p className="text-fg-muted">CSV files open in Excel, Numbers or Google Sheets. Cells starting with = + - @ are escaped so they can't run as formulas.</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <li key={e.type} className="card flex flex-col gap-3 p-5">
            <h2 className="font-bold">{e.label}</h2>
            <p className="text-sm text-fg-muted">{e.body}</p>
            <a href={`/api/admin/export?type=${e.type}`} className="mt-auto inline-flex min-h-11 w-fit items-center rounded-full bg-white/10 px-5 text-sm font-semibold" download>
              Download CSV
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
