import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderForms } from "@/db/schema";
import { signedReadUrl } from "@/lib/storage/storage";
import { StatusPill } from "./status-pill";

/**
 * What the family sent, for the people who have to make it.
 *
 * The order form was reachable by the customer and by nobody else — the
 * designer assigned to the job could see the order's reference and its
 * status, but not the name to print, the date of the service, or the
 * photographs that had been uploaded for the cover. The work could not be
 * started from this screen at all.
 *
 * It loads its own row rather than being handed one, so adding it to a page
 * is one line and there is one place where the shape of this is decided.
 */

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const PHOTO_OPTION: Record<string, string> = {
  none: "No photograph",
  colour: "In colour",
  bw: "Black and white",
};

const INSIDE_PAGES: Record<string, string> = {
  bw: "Black and white",
  match_cover: "Match the cover",
};

/** A date column holds "2026-09-26"; showing it as typed beats a timezone bug. */
function readableDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormat.format(parsed);
}

function Field({ label, value }: { label: string; value: string | null }) {
  // An unanswered question is left out rather than shown empty: the form is
  // optional throughout, and a column of dashes hides the answers that are
  // there.
  if (!value) return null;

  return (
    <div className="flex flex-col gap-0.5 border-b border-line-soft py-2.5 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap text-[14px] leading-relaxed">
        {value}
      </dd>
    </div>
  );
}

export async function OrderFormSummary({ orderId }: { orderId: string }) {
  const [form] = await db
    .select()
    .from(orderForms)
    .where(eq(orderForms.orderId, orderId))
    .limit(1);

  if (!form) {
    return (
      <section className="rounded-md border border-line bg-card p-6">
        <h2 className="font-display text-lg">Order Form</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          The customer has not started their order form yet, so there are no
          details to work from.
        </p>
      </section>
    );
  }

  const sent = form.submittedAt !== null;

  /**
   * Both shapes of attachment.
   *
   * Forms saved before the studio could take more than one file kept a single
   * key of their own, and those orders are still live work.
   */
  const files = [
    ...(form.attachments ?? []),
    ...(form.attachmentKey
      ? [
          {
            key: form.attachmentKey,
            name: form.attachmentName ?? "Attachment",
            size: 0,
            type: "",
          },
        ]
      : []),
  ];

  /*
    Two links per file: one to look at it, one to save it.

    Both point at the original bytes — nothing here is resized or
    re-compressed, so what a designer downloads is the file the family
    uploaded, at the resolution they uploaded it.
  */
  const withUrls = await Promise.all(
    files.map(async (file) => ({
      ...file,
      url: await signedReadUrl(file.key),
      downloadUrl: await signedReadUrl(file.key, file.name),
      isImage: file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name),
    })),
  );

  const products = form.additionalProducts ?? [];

  return (
    <section className="rounded-md border border-line bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg">Order Form</h2>
        <StatusPill tone={sent ? "good" : "pending"}>
          {sent
            ? `Sent ${dateFormat.format(form.submittedAt as Date)}`
            : "Draft — not sent yet"}
        </StatusPill>
      </div>

      {!sent && (
        <p className="mt-3 rounded-[4px] bg-pending-tint px-[14px] py-3 text-[13px] leading-relaxed text-pending-deep">
          The customer is still filling this in. Anything below may still
          change before they send it.
        </p>
      )}

      <div className="mt-4 grid gap-x-8 lg:grid-cols-2">
        <dl className="flex flex-col">
          <Field label="Name of the deceased" value={form.deceasedName} />
          <Field label="Date of birth" value={readableDate(form.dateOfBirth)} />
          <Field label="Date of death" value={readableDate(form.dateOfDeath)} />
          <Field label="Age" value={form.ageOfDeceased} />
          <Field
            label="Date of the service"
            value={readableDate(form.funeralDate)}
          />
          <Field label="Time" value={form.funeralTime} />
          <Field label="Church, crematorium or venue" value={form.venueName} />
          <Field label="Branch" value={form.branchName} />
          <Field label="Arranger" value={form.arrangerName} />
        </dl>

        <dl className="flex flex-col">
          <Field
            label="Cover photograph"
            value={form.photoOption ? PHOTO_OPTION[form.photoOption] : null}
          />
          <Field
            label="Pages"
            value={form.numberOfPages ? String(form.numberOfPages) : null}
          />
          <Field
            label="Inside pages"
            value={
              form.insidePagesStyle ? INSIDE_PAGES[form.insidePagesStyle] : null
            }
          />
          <Field
            label="How many copies"
            value={form.quantity ? String(form.quantity) : null}
          />
          <Field
            label="Bespoke design"
            value={form.bespokeDesign ? (form.bespokeDetails ?? "Yes") : null}
          />
          <Field
            label="Photographs supplied"
            value={form.photoQty === null ? null : String(form.photoQty)}
          />
          <Field
            label="About the photographs"
            value={form.photoInstructions}
          />
          <Field
            label="Phone call requested"
            value={
              form.callbackRequested
                ? (form.callbackPhone ?? "Yes — no number given")
                : null
            }
          />
        </dl>
      </div>

      <div className="grid gap-x-8 lg:grid-cols-2">
        <dl className="flex flex-col">
          <Field label="Back cover wording" value={form.backpageInformation} />
        </dl>
        <dl className="flex flex-col">
          <Field label="Notes for the design team" value={form.additionalNotes} />
        </dl>
      </div>

      {products.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
            Other Pieces
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {products.map((product, index) => (
              <li key={index} className="text-[14px]">
                {product.title}
                {product.size ? ` · ${product.size}` : ""} × {product.quantity}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        The photographs, big enough to judge.

        A list of file names is no use to whoever has to place them on a
        cover — they need to see which picture is which before they open
        anything.
      */}
      {withUrls.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
            {withUrls.length === 1
              ? "1 file from the customer"
              : `${withUrls.length} files from the customer`}
          </h3>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {withUrls.map((file) => (
              <li key={file.key} className="flex flex-col gap-1.5">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block"
                >
                  <span className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[3px] border border-line bg-surface-grey">
                    {file.isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                        {file.name.split(".").pop() ?? "File"}
                      </span>
                    )}
                  </span>
                </a>

                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-ink-muted">
                    {file.name}
                  </span>

                  {/*
                    Its own link, outside the one that opens the picture: a
                    button inside an anchor is not a thing, and a designer
                    wants the original file rather than a browser tab.
                  */}
                  <a
                    href={file.downloadUrl}
                    download={file.name}
                    title={`Download ${file.name}${file.size > 0 ? ` (${Math.max(1, Math.round(file.size / 1024))} KB)` : ""}`}
                    aria-label={`Download ${file.name}`}
                    className="shrink-0 rounded-[3px] p-1 text-ink-quiet hover:bg-surface-grey hover:text-accent-text"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M8 2v8" />
                      <path d="m4.5 7 3.5 3.5L11.5 7" />
                      <path d="M2.5 12.5v1h11v-1" />
                    </svg>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-5 flex flex-col border-t border-line pt-3">
        <Field
          label="Send the printing to"
          value={
            [
              form.shippingName,
              form.shippingLine1,
              form.shippingLine2,
              form.shippingCity,
              form.shippingPostcode,
              form.shippingCountry,
            ]
              .filter(Boolean)
              .join("\n") || null
          }
        />
      </dl>
    </section>
  );
}
