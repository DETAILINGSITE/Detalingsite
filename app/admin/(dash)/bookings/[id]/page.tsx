import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ActionForm, AdminCheck, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/action-form";
import { STATUS_LABELS } from "@/lib/domain/booking-state";
import { formatDuration, formatMoney } from "@/lib/domain/money";
import { formatDateTimeLong } from "@/lib/domain/time";
import { formatPhoneForDisplay } from "@/lib/validation/booking";
import { bookingDetail } from "@/lib/server/admin/queries";
import { requireAdminPage } from "@/lib/server/admin-guard";
import { formatAddress } from "@/lib/server/booking/location";
import { loadSettings } from "@/lib/server/data/settings";
import { getDb } from "@/db/client";
import { bookingBalanceAction, bookingCancelAction, bookingNotesAction, bookingStatusAction } from "../../actions";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const session = await requireAdminPage();
  const { id } = await params;
  const d = await bookingDetail(id);
  if (!d) notFound();
  const { booking: b, customer: c } = d;
  const depositRefundable = (await loadSettings(getDb())).cancellation.depositRefundable;
  const balance = b.totalCents - b.depositCents - b.balancePaidCents;
  const live = b.status === "confirmed" || b.status === "in_progress";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/bookings" className="text-sm text-fg-muted hover:text-fg">← Bookings</Link>
        <h1 className="text-3xl font-bold">
          {b.number} <span className="ml-2 align-middle text-base font-medium text-fg-muted">{STATUS_LABELS[b.status]}</span>
        </h1>
        <p className="text-fg-muted">
          {formatDateTimeLong(b.startsAt.getTime(), b.timezone)} · {formatDuration(b.durationMin)} · {d.resource?.name ?? "No crew/bay"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2" aria-labelledby="job-h">
          <h2 id="job-h" className="mb-3 font-bold">Job</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-fg-subtle">Vehicle</dt><dd>{[b.vehicleYear, b.vehicleMake, b.vehicleModel, b.vehicleColor].filter(Boolean).join(" ") || "—"} · {b.priceSnapshot.sizeLabel}</dd></div>
            <div><dt className="text-fg-subtle">Location</dt><dd>{b.locationType === "shop" ? "Shop" : formatAddress(b.address)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-fg-subtle">Access notes</dt><dd>{b.accessNotes || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-fg-subtle">Conditions</dt><dd>{b.conditionIds.join(", ") || "—"}</dd></div>
          </dl>
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-white/[0.08] pt-4 text-sm">
            {b.priceSnapshot.lines.map((l, i) => (
              <li key={i} className="flex justify-between"><span>{l.label}</span><span className="tabular">{formatMoney(l.amountCents)}</span></li>
            ))}
            <li className="flex justify-between border-t border-white/[0.08] pt-2 font-bold"><span>Total</span><span className="tabular">{formatMoney(b.totalCents)}</span></li>
            <li className="flex justify-between text-fg-muted"><span>Deposit</span><span className="tabular">{formatMoney(b.depositCents)}</span></li>
            <li className="flex justify-between text-fg-muted"><span>Balance paid</span><span className="tabular">{formatMoney(b.balancePaidCents)}</span></li>
            <li className="flex justify-between font-semibold"><span>Balance due</span><span className="tabular">{formatMoney(Math.max(0, balance))}</span></li>
            {b.feeOwedCents > 0 && <li className="flex justify-between text-warning"><span>Late fee owed</span><span className="tabular">{formatMoney(b.feeOwedCents)}</span></li>}
          </ul>
        </section>
        <section className="card p-5" aria-labelledby="cust-h">
          <h2 id="cust-h" className="mb-3 font-bold">Customer</h2>
          {c ? (
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href={`/admin/customers/${c.id}`} className="font-semibold text-gold-300 hover:underline">{c.name}</Link>
              {c.email && <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>}
              {c.phoneE164 && <a href={`tel:${c.phoneE164}`} className="hover:underline">{formatPhoneForDisplay(c.phoneE164)}</a>}
              <span className="text-fg-muted">Prefers {c.preferredContact} · SMS {c.smsConsentAt && !c.smsOptOutAt ? "opted in" : "not opted in"}</span>
              <span className="text-fg-muted">Heard via: {b.heardAbout ?? "—"} · Source: {b.attribution.utmSource ?? (b.attribution.referrer ? "referral" : "direct")}</span>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">No contact details yet.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card flex flex-col gap-5 p-5" aria-labelledby="act-h">
          <h2 id="act-h" className="font-bold">Actions</h2>
          {live && (
            <div className="flex flex-wrap gap-3">
              {b.status === "confirmed" && (
                <ActionForm action={bookingStatusAction} submitLabel="Start job" variant="secondary">
                  <input type="hidden" name="id" value={b.id} /><input type="hidden" name="event" value="start" />
                </ActionForm>
              )}
              <ActionForm action={bookingStatusAction} submitLabel="Mark completed" variant="secondary">
                <input type="hidden" name="id" value={b.id} /><input type="hidden" name="event" value="complete" />
              </ActionForm>
              <ActionForm action={bookingStatusAction} submitLabel="Mark no-show" variant="secondary" confirm="Mark this booking as a no-show? The deposit is kept.">
                <input type="hidden" name="id" value={b.id} /><input type="hidden" name="event" value="no_show" />
              </ActionForm>
            </div>
          )}
          {b.status === "confirmed" && (
            <p className="text-sm text-fg-muted">
              To move this booking, drag it on the <Link href="/admin/calendar" className="text-gold-300 underline">calendar</Link> or use its “Move” button there.
            </p>
          )}
          {(live || b.status === "completed") && balance > 0 && (
            <ActionForm action={bookingBalanceAction} submitLabel="Record payment">
              <input type="hidden" name="id" value={b.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInput label="Amount ($)" name="amount" type="number" step="0.01" defaultValue={(balance / 100).toFixed(2)} required />
                <AdminSelect label="Method" name="method" defaultValue="card_terminal" options={[{ value: "card_terminal", label: "Card terminal" }, { value: "cash", label: "Cash" }, { value: "other", label: "Other" }]} />
              </div>
              <AdminInput label="Note" name="note" />
            </ActionForm>
          )}
          {b.status === "confirmed" && session.role === "owner" && (
            <ActionForm action={bookingCancelAction} submitLabel="Cancel booking" variant="danger" confirm="Cancel this booking and notify the customer?">
              <input type="hidden" name="id" value={b.id} />
              <AdminCheck label={depositRefundable ? "Waive late fee (full deposit refund)" : "Refund the deposit anyway (it's non-refundable by policy)"} name="waiveFee" defaultChecked={depositRefundable} />
              <AdminInput label="Reason" name="reason" />
            </ActionForm>
          )}
        </section>
        <section className="card p-5" aria-labelledby="notes-h">
          <h2 id="notes-h" className="mb-3 font-bold">Internal notes</h2>
          <ActionForm action={bookingNotesAction}>
            <input type="hidden" name="id" value={b.id} />
            <AdminTextarea label="Notes (never shown to the customer)" name="notes" defaultValue={b.internalNotes} rows={6} />
          </ActionForm>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="pay-h">
          <h2 id="pay-h" className="mb-3 font-bold">Payments</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {d.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>{p.kind} · {p.method} · {p.status}{p.note ? ` · ${p.note}` : ""}</span>
                <span className="tabular">{formatMoney(p.amountCents)}</span>
              </li>
            ))}
            {d.payments.length === 0 && <li className="text-fg-muted">None.</li>}
          </ul>
        </section>
        <section className="card p-5" aria-labelledby="hist-h">
          <h2 id="hist-h" className="mb-3 font-bold">History & messages</h2>
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto text-xs text-fg-muted">
            {d.events.map((e) => (
              <li key={`e${e.id}`}>{e.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {e.type} ({e.actor}){e.toStatus ? ` → ${e.toStatus}` : ""}</li>
            ))}
            {d.messages.map((m) => (
              <li key={m.id}>{m.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {m.type} {(m.payload as { template?: string }).template ?? ""} · {m.status}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
