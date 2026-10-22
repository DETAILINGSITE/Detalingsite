import { connection } from "next/server";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata = pageMetadata({ title: "Confirming payment", description: "Confirming your payment.", path: "/book/return", noindex: true });

/** Stripe redirect target (e.g. after 3-D Secure). The booking page polls for webhook confirmation. */
export default async function ReturnPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await connection();
  const { t } = await searchParams;
  if (t && /^[A-Za-z0-9_-]{43}$/.test(t)) redirect(`/booking/${t}?new=1`);
  redirect("/book");
}
