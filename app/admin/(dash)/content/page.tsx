import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { ActionForm, AdminCheck, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/action-form";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { faqSaveAction, galleryItemAction, testimonialSaveAction } from "../actions";

export default async function ContentPage() {
  await connection();
  const db = getDb();
  const [reviews, faqs, gallery, services] = await Promise.all([
    db.select().from(s.testimonials).orderBy(asc(s.testimonials.sort)),
    db.select().from(s.faqs).orderBy(asc(s.faqs.category), asc(s.faqs.sort)),
    db.select().from(s.galleryItems).orderBy(asc(s.galleryItems.sort)),
    db.select({ id: s.services.id, name: s.services.name }).from(s.services).orderBy(asc(s.services.sort)),
  ]);
  const svcOptions = [{ value: "", label: "—" }, ...services.map((x) => ({ value: x.id, label: x.name }))];
  const del = (action: typeof testimonialSaveAction, id: string) => (
    <ActionForm action={action} submitLabel="Delete" variant="danger" confirm="Delete this item?">
      <input type="hidden" name="op" value="delete" />
      <input type="hidden" name="id" value={id} />
    </ActionForm>
  );
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-bold">Content</h1>
      <p className="-mt-6 text-sm text-fg-muted">Items marked “sample” show a visible Sample label on the site until you edit or delete them. Publish real reviews only.</p>

      <section aria-labelledby="rv-h" className="flex flex-col gap-4">
        <h2 id="rv-h" className="text-xl font-bold">Reviews</h2>
        {[...reviews, undefined].map((r) => (
          <details key={r?.id ?? "new"} className="card p-4">
            <summary className="cursor-pointer font-semibold">{r ? `${r.authorName} · ${r.rating}★${r.isPlaceholder ? " · sample" : ""}${r.published ? "" : " · hidden"}` : "+ Add a real review"}</summary>
            <div className="mt-4 flex flex-col gap-3">
              <ActionForm action={testimonialSaveAction}>
                <input type="hidden" name="id" value={r?.id ?? ""} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminInput label="Name (first name + initial)" name="authorName" defaultValue={r?.authorName} required />
                  <AdminInput label="Vehicle" name="vehicle" defaultValue={r?.vehicle} />
                  <AdminInput label="Rating" name="rating" type="number" defaultValue={r?.rating ?? 5} />
                  <AdminSelect label="Source" name="source" defaultValue={r?.source ?? "google"} options={["google", "yelp", "facebook", "direct"].map((v) => ({ value: v, label: v }))} />
                  <AdminInput label="Link to review" name="sourceUrl" defaultValue={r?.sourceUrl} />
                  <AdminInput label="Date" name="reviewDate" type="date" defaultValue={r?.reviewDate} />
                </div>
                <AdminTextarea label="Review text (exactly as written)" name="body" defaultValue={r?.isPlaceholder ? "" : r?.body} rows={4} />
                <div className="flex gap-4">
                  <AdminCheck label="Published" name="published" defaultChecked={r?.published ?? true} />
                  <AdminInput label="Sort" name="sort" type="number" defaultValue={r?.sort ?? 0} className="w-24" />
                </div>
              </ActionForm>
              {r && del(testimonialSaveAction, r.id)}
            </div>
          </details>
        ))}
      </section>

      <section aria-labelledby="gl-h" className="flex flex-col gap-4">
        <h2 id="gl-h" className="text-xl font-bold">Gallery (before & after)</h2>
        <p className="text-sm text-fg-muted">Upload photos to /public/images/gallery (or your media bucket) and paste their paths. Use the same framing for before and after.</p>
        {[...gallery, undefined].map((g) => (
          <details key={g?.id ?? "new"} className="card p-4">
            <summary className="cursor-pointer font-semibold">{g ? `${g.title}${g.isPlaceholder ? " · sample" : ""}` : "+ Add a project"}</summary>
            <div className="mt-4 flex flex-col gap-3">
              <ActionForm action={galleryItemAction}>
                <input type="hidden" name="id" value={g?.id ?? ""} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminInput label="Title" name="title" defaultValue={g?.title} required />
                  <AdminInput label="Vehicle" name="vehicle" defaultValue={g?.vehicle} />
                  <AdminSelect label="Service" name="serviceId" defaultValue={g?.serviceId ?? ""} options={svcOptions} />
                  <AdminInput label="Before image path/URL" name="beforeSrc" defaultValue={g?.beforeSrc} required />
                  <AdminInput label="After image path/URL" name="afterSrc" defaultValue={g?.afterSrc} required />
                  <AdminInput label="Sort" name="sort" type="number" defaultValue={g?.sort ?? 0} />
                  <AdminInput label="Alt text (before)" name="altBefore" defaultValue={g?.altBefore} required />
                  <AdminInput label="Alt text (after)" name="altAfter" defaultValue={g?.altAfter} required />
                </div>
                <AdminCheck label="Published" name="published" defaultChecked={g?.published ?? true} />
              </ActionForm>
              {g && del(galleryItemAction, g.id)}
            </div>
          </details>
        ))}
      </section>

      <section aria-labelledby="fq-h" className="flex flex-col gap-4">
        <h2 id="fq-h" className="text-xl font-bold">FAQs</h2>
        {[...faqs, undefined].map((f) => (
          <details key={f?.id ?? "new"} className="card p-4">
            <summary className="cursor-pointer font-semibold">{f ? `${f.category}: ${f.question}` : "+ Add a question"}</summary>
            <div className="mt-4 flex flex-col gap-3">
              <ActionForm action={faqSaveAction}>
                <input type="hidden" name="id" value={f?.id ?? ""} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminInput label="Category" name="category" defaultValue={f?.category ?? "General"} required />
                  <AdminSelect label="Show on service page" name="serviceId" defaultValue={f?.serviceId ?? ""} options={svcOptions} />
                  <AdminInput label="Sort" name="sort" type="number" defaultValue={f?.sort ?? 0} />
                </div>
                <AdminInput label="Question" name="question" defaultValue={f?.question} required />
                <AdminTextarea label="Answer" name="answerMd" defaultValue={f?.answerMd} rows={4} />
                <div className="flex gap-4">
                  <AdminCheck label="Featured on home page" name="featured" defaultChecked={f?.featured} />
                  <AdminCheck label="Published" name="published" defaultChecked={f?.published ?? true} />
                </div>
              </ActionForm>
              {f && del(faqSaveAction, f.id)}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
