import { connection } from "next/server";
import { ActionForm, AdminCheck, AdminInput, AdminSelect } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import { requireAdminPage } from "@/lib/server/admin-guard";
import { loadSettings } from "@/lib/server/data/settings";
import { settingsSaveAction } from "../actions";

export default async function SettingsPage() {
  await connection();
  await requireAdminPage({ role: "owner" });
  const st = await loadSettings(getDb());
  const depVal = st.deposit.mode === "fixed" ? (st.deposit.valueCents / 100).toFixed(2) : st.deposit.mode === "percent" ? st.deposit.percent : "";
  const fee = st.cancellation.lateFee;
  const feeVal = fee.type === "fixed" ? (fee.cents / 100).toFixed(2) : fee.type === "percent" ? fee.percent : "";
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <ActionForm action={settingsSaveAction} submitLabel="Save settings">
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="bk-h">
          <h2 id="bk-h" className="font-bold">Booking</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminSelect label="Service mode" name="serviceMode" defaultValue={st.serviceMode} options={[{ value: "both", label: "Mobile + shop" }, { value: "mobile", label: "Mobile only" }, { value: "shop", label: "Shop only" }]} />
            <AdminInput label="Start times every (min)" name="slotIntervalMin" type="number" defaultValue={st.slotIntervalMin} />
            <AdminInput label="Buffer between jobs (min)" name="bufferMin" type="number" defaultValue={st.bufferMin} />
            <AdminInput label="Minimum notice (hours)" name="minLeadHours" type="number" defaultValue={st.minLeadHours} />
            <AdminInput label="Book up to (days ahead)" name="maxDaysAhead" type="number" defaultValue={st.maxDaysAhead} />
            <AdminInput label="Slot hold (min)" name="holdMinutes" type="number" defaultValue={st.holdMinutes} />
            <AdminInput label="Hold during payment (min)" name="paymentHoldMinutes" type="number" defaultValue={st.paymentHoldMinutes} />
          </div>
          <AdminCheck label="Travel time must fit inside opening hours" name="travelCountsAgainstHours" defaultChecked={st.travelCountsAgainstHours} />
        </section>
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="dep-h">
          <h2 id="dep-h" className="font-bold">Deposit & cancellations</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminSelect label="Deposit" name="depositMode" defaultValue={st.deposit.mode} options={[{ value: "fixed", label: "Fixed amount ($)" }, { value: "percent", label: "Percent of total (%)" }, { value: "none", label: "No deposit (pay at appointment)" }]} />
            <AdminInput label="Deposit amount ($ or %)" name="depositValue" type="number" step="0.01" defaultValue={depVal} />
            <AdminInput label="Free cancellation until (hours before)" name="windowHours" type="number" defaultValue={st.cancellation.windowHours} />
            <AdminSelect label="Late cancellation" name="lateFeeType" defaultValue={fee.type} options={[{ value: "forfeit_deposit", label: "Keep the deposit" }, { value: "fixed", label: "Fixed fee ($)" }, { value: "percent", label: "Percent of total (%)" }]} />
            <AdminInput label="Late fee ($ or %)" name="lateFeeValue" type="number" step="0.01" defaultValue={feeVal} />
            <AdminInput label="Online reschedule until (hours before)" name="rescheduleMinHours" type="number" defaultValue={st.reschedule.minHoursBefore} />
            <AdminInput label="Max online reschedules" name="rescheduleMax" type="number" defaultValue={st.reschedule.maxCount} />
          </div>
          <AdminCheck label="Refund the deposit when a customer cancels early (untick for a non-refundable deposit)" name="depositRefundable" defaultChecked={st.cancellation.depositRefundable} />
        </section>
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="pr-h">
          <h2 id="pr-h" className="font-bold">Pricing</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput label="Sales tax (%)" name="taxRatePercent" type="number" step="0.01" defaultValue={st.taxRateBps / 100} />
            <AdminSelect label="Round size-adjusted prices to" name="priceRoundingCents" defaultValue={String(st.priceRoundingCents)} options={[{ value: "1", label: "Exact cents" }, { value: "100", label: "Whole dollars" }, { value: "500", label: "Nearest $5" }]} />
          </div>
          <AdminCheck label="Charge tax on travel fees" name="taxTravel" defaultChecked={st.taxTravel} />
          <AdminCheck label="I've reviewed all prices and durations (removes the sample-price labels from the launch check)" name="catalogReviewed" defaultChecked={st.catalogReviewed} />
        </section>
      </ActionForm>
    </div>
  );
}
