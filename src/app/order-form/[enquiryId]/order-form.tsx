"use client";

import { useActionState, useState } from "react";
import { saveOrderFormAction } from "@/lib/order-form/actions";
import { emptyFormState } from "@/lib/auth/form-state";
import {
  DEFAULT_QUANTITY,
  MAX,
  MIN_QUANTITY,
  PAGE_COUNTS,
  QUANTITY_PRESETS,
} from "@/lib/order-form/schema";
import { ACCEPT_ATTRIBUTE } from "@/lib/storage/uploads";
import type { OrderFormRow, ProductChoice } from "./types";

const inputClass =
  "w-full rounded-[3px] border border-field-line bg-card px-[15px] py-[13px] text-[15px] text-ink";
const errorClass = "border-alert";

function Row({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-[14px] font-semibold text-ink-soft">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="text-[13px] text-ink-quiet">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-[13px] font-medium text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-[3px] border px-4 py-3 text-[15px] ${
        checked ? "border-brand bg-brand-tint text-blue" : "border-field-line"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="size-4"
      />
      {children}
    </label>
  );
}

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-line pt-10">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[24px]">{title}</h2>
        {intro && (
          <p className="max-w-[60ch] text-[14px] leading-relaxed text-ink-muted">
            {intro}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

export function OrderForm({
  enquiryId,
  saved,
  products,
}: {
  enquiryId: string;
  saved: OrderFormRow | null;
  products: ProductChoice[];
}) {
  const [state, formAction] = useActionState(
    saveOrderFormAction,
    emptyFormState,
  );
  const errors = state.errors ?? {};

  // Only the answers that change what else is on screen are held here. The
  // rest are ordinary uncontrolled inputs with their saved value as default,
  // so a long form doesn't re-render on every keystroke.
  const [photoOption, setPhotoOption] = useState(saved?.photoOption ?? "");
  const [pages, setPages] = useState(saved?.numberOfPages ?? null);
  const [insideStyle, setInsideStyle] = useState(saved?.insidePagesStyle ?? "");
  const [quantity, setQuantity] = useState(saved?.quantity ?? DEFAULT_QUANTITY);
  const [bespoke, setBespoke] = useState(saved?.bespokeDesign ?? false);
  const [suppliedVia, setSuppliedVia] = useState(saved?.photoSuppliedVia ?? "");
  const [callback, setCallback] = useState(saved?.callbackRequested ?? false);

  const [rows, setRows] = useState(saved?.additionalProducts ?? []);
  const [attachment, setAttachment] = useState(
    saved?.attachmentKey
      ? { key: saved.attachmentKey, name: saved.attachmentName ?? "Attached file" }
      : null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /**
   * Sends the file to storage before the form is submitted, and keeps only
   * the key it was given. The bytes never pass through the server action, so
   * a large photograph can't time the submission out.
   */
  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);

    try {
      const ticket = await fetch(
        `/api/order-form/${enquiryId}/attachment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            size: file.size,
          }),
        },
      ).then((response) => response.json());

      if (!ticket?.uploadUrl) {
        setUploadError(ticket?.error ?? "That file couldn't be sent. Try again.");
        return;
      }

      const put = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!put.ok) {
        setUploadError("That file couldn't be sent. Try again.");
        return;
      }

      setAttachment({ key: ticket.storageKey, name: file.name });
    } catch {
      setUploadError("That file couldn't be sent. Try again.");
    } finally {
      setUploading(false);
    }
  }

  /**
   * Once it is sent, the form is replaced here and now rather than waiting
   * for the page to be reloaded. Returning nothing would leave whoever just
   * pressed the button looking at an empty page, unsure it worked.
   */
  if (state.ok && state.message === "Order form received.") {
    return (
      <div className="flex flex-col gap-4 rounded-md border border-brand-line bg-brand-tint p-10">
        <h2 className="font-display text-[26px]">Order form received</h2>
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-ink-muted">
          Thank you. Everything you sent is with the design team, and we will
          be in touch with a proof before anything is printed.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-10">
      <input type="hidden" name="enquiryId" value={enquiryId} />

      {state.message && (
        <p
          role="status"
          className={`rounded-[4px] px-[18px] py-4 text-[14px] font-medium ${
            state.ok
              ? "bg-good-tint text-good-deep"
              : "bg-alert-tint text-alert"
          }`}
        >
          {state.message}
        </p>
      )}

      <section className="flex flex-col gap-6">
        <h2 className="font-display text-[24px]">Who the service is for</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Row
              label="Name of the deceased, as it should appear"
              name="deceasedName"
              error={errors.deceasedName}
            >
              <input
                id="deceasedName"
                name="deceasedName"
                defaultValue={saved?.deceasedName ?? ""}
                maxLength={MAX.name}
                aria-invalid={errors.deceasedName ? true : undefined}
                className={`${inputClass} ${errors.deceasedName ? errorClass : ""}`}
              />
            </Row>
          </div>

          <Row label="Date of birth" name="dateOfBirth" error={errors.dateOfBirth}>
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              defaultValue={saved?.dateOfBirth ?? ""}
              className={`${inputClass} ${errors.dateOfBirth ? errorClass : ""}`}
            />
          </Row>

          <Row label="Date of death" name="dateOfDeath" error={errors.dateOfDeath}>
            <input
              id="dateOfDeath"
              name="dateOfDeath"
              type="date"
              defaultValue={saved?.dateOfDeath ?? ""}
              className={`${inputClass} ${errors.dateOfDeath ? errorClass : ""}`}
            />
          </Row>

          <Row
            label="Age"
            name="ageOfDeceased"
            error={errors.ageOfDeceased}
            hint="However you would like it written."
          >
            <input
              id="ageOfDeceased"
              name="ageOfDeceased"
              defaultValue={saved?.ageOfDeceased ?? ""}
              maxLength={MAX.age}
              className={`${inputClass} ${errors.ageOfDeceased ? errorClass : ""}`}
            />
          </Row>
        </div>
      </section>

      <Section title="The service">
        <div className="grid gap-6 sm:grid-cols-2">
          <Row label="Date" name="funeralDate" error={errors.funeralDate}>
            <input
              id="funeralDate"
              name="funeralDate"
              type="date"
              defaultValue={saved?.funeralDate ?? ""}
              className={`${inputClass} ${errors.funeralDate ? errorClass : ""}`}
            />
          </Row>

          <Row
            label="Time"
            name="funeralTime"
            error={errors.funeralTime}
            hint="For example, 11.30am."
          >
            <input
              id="funeralTime"
              name="funeralTime"
              defaultValue={saved?.funeralTime ?? ""}
              maxLength={MAX.time}
              className={`${inputClass} ${errors.funeralTime ? errorClass : ""}`}
            />
          </Row>

          <div className="sm:col-span-2">
            <Row label="Where it is being held" name="venueName" error={errors.venueName}>
              <input
                id="venueName"
                name="venueName"
                defaultValue={saved?.venueName ?? ""}
                maxLength={MAX.venue}
                className={`${inputClass} ${errors.venueName ? errorClass : ""}`}
              />
            </Row>
          </div>
        </div>
      </Section>

      <Section title="The booklet">
        <input type="hidden" name="photoOption" value={photoOption} />
        <Row label="A photograph on the cover" name="photoOption" error={errors.photoOption}>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Choice name="photoOptionChoice" value="none" checked={photoOption === "none"} onChange={setPhotoOption}>
              No photograph
            </Choice>
            <Choice name="photoOptionChoice" value="colour" checked={photoOption === "colour"} onChange={setPhotoOption}>
              In colour
            </Choice>
            <Choice name="photoOptionChoice" value="bw" checked={photoOption === "bw"} onChange={setPhotoOption}>
              Black and white
            </Choice>
          </div>
        </Row>

        <input type="hidden" name="numberOfPages" value={pages ?? ""} />
        <Row label="How many pages" name="numberOfPages" error={errors.numberOfPages}>
          <div className="flex flex-wrap gap-2.5">
            {PAGE_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPages(count)}
                aria-pressed={pages === count}
                className={`rounded-full border px-6 py-2.5 text-[14px] font-medium ${
                  pages === count
                    ? "border-brand bg-brand-tint text-blue"
                    : "border-field-line text-ink-soft hover:border-brand"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </Row>

        <input type="hidden" name="insidePagesStyle" value={insideStyle} />
        <Row label="The inside pages" name="insidePagesStyle" error={errors.insidePagesStyle}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Choice name="insideChoice" value="bw" checked={insideStyle === "bw"} onChange={setInsideStyle}>
              Black and white
            </Choice>
            <Choice name="insideChoice" value="match_cover" checked={insideStyle === "match_cover"} onChange={setInsideStyle}>
              Match the cover
            </Choice>
          </div>
        </Row>

        <Row
          label="How many copies"
          name="quantity"
          error={errors.quantity}
          hint={`The smallest run we print is ${MIN_QUANTITY}. Most families order a few more than the number expected.`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {QUANTITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuantity(preset)}
                  aria-pressed={quantity === preset}
                  className={`rounded-full border px-5 py-2 text-[14px] font-medium ${
                    quantity === preset
                      ? "border-brand bg-brand-tint text-blue"
                      : "border-field-line text-ink-soft hover:border-brand"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={MIN_QUANTITY}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value) || 0)}
              className={`w-[160px] ${inputClass} ${errors.quantity ? errorClass : ""}`}
            />
          </div>
        </Row>

        <label className="flex items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            name="bespokeDesign"
            checked={bespoke}
            onChange={(event) => setBespoke(event.target.checked)}
            className="size-4"
          />
          I would like something designed specially
        </label>

        {bespoke && (
          <Row
            label="What you have in mind"
            name="bespokeDetails"
            error={errors.bespokeDetails}
          >
            <textarea
              id="bespokeDetails"
              name="bespokeDetails"
              rows={5}
              maxLength={MAX.longText}
              defaultValue={saved?.bespokeDetails ?? ""}
              className={`${inputClass} font-sans ${errors.bespokeDetails ? errorClass : ""}`}
            />
          </Row>
        )}
      </Section>

      <Section
        title="Photographs"
        intro="Send them however is easiest. If you would rather post originals, we scan them and send them back with the order."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Row
            label="How many photographs"
            name="photoQty"
            error={errors.photoQty}
          >
            <input
              id="photoQty"
              name="photoQty"
              type="number"
              min={0}
              max={MAX.photoQty}
              defaultValue={saved?.photoQty ?? ""}
              className={`${inputClass} ${errors.photoQty ? errorClass : ""}`}
            />
          </Row>

          <div>
            <input type="hidden" name="photoSuppliedVia" value={suppliedVia} />
            <Row label="How you'll send them" name="photoSuppliedVia" error={errors.photoSuppliedVia}>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Choice name="suppliedChoice" value="email" checked={suppliedVia === "email"} onChange={setSuppliedVia}>
                  By email
                </Choice>
                <Choice name="suppliedChoice" value="post" checked={suppliedVia === "post"} onChange={setSuppliedVia}>
                  By post
                </Choice>
              </div>
            </Row>
          </div>
        </div>

        <Row
          label="Anything we should know about them"
          name="photoInstructions"
          error={errors.photoInstructions}
          hint="Which one belongs on the cover, who is who, anything to leave out."
        >
          <textarea
            id="photoInstructions"
            name="photoInstructions"
            rows={4}
            maxLength={MAX.instructions}
            defaultValue={saved?.photoInstructions ?? ""}
            className={`${inputClass} font-sans ${errors.photoInstructions ? errorClass : ""}`}
          />
        </Row>

        <input type="hidden" name="attachmentKey" value={attachment?.key ?? ""} />
        <input type="hidden" name="attachmentName" value={attachment?.name ?? ""} />

        <Row label="Attach a file" name="attachment" hint="One file, if you have something ready to send now.">
          <div className="flex flex-col gap-3">
            <input
              id="attachment"
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
              className="rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm file:mr-3 file:rounded-[2px] file:border-0 file:bg-surface-grey file:px-3 file:py-1.5 file:text-[13px] file:font-semibold"
            />

            {uploading && (
              <p role="status" className="text-[13px] text-ink-muted">
                Sending…
              </p>
            )}

            {attachment && !uploading && (
              <p className="flex items-center gap-3 text-[13px] text-good-deep">
                {attachment.name} is attached.
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="font-semibold text-ink-quiet underline"
                >
                  Remove
                </button>
              </p>
            )}

            {uploadError && (
              <p className="text-[13px] font-medium text-alert">{uploadError}</p>
            )}
          </div>
        </Row>
      </Section>

      <Section
        title="Anything else"
        intro="Other pieces you would like printed alongside the booklet, and the wording for the back cover."
      >
        <Row
          label="Other pieces"
          name="additionalProducts"
          error={errors.additionalProducts}
        >
          <div className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-[3px] border border-line bg-surface-grey p-3 sm:grid-cols-[2fr_1fr_auto_auto]"
              >
                <select
                  name="productSlug"
                  value={row.slug}
                  onChange={(event) => {
                    const product = products.find(
                      (item) => item.slug === event.target.value,
                    );
                    setRows((current) =>
                      current.map((item, at) =>
                        at === index
                          ? {
                              ...item,
                              slug: event.target.value,
                              title: product?.name ?? "",
                              size: product?.sizes[0] ?? "",
                            }
                          : item,
                      ),
                    );
                  }}
                  aria-label={`Piece ${index + 1}`}
                  className={inputClass}
                >
                  <option value="">Choose a piece</option>
                  {products.map((product) => (
                    <option key={product.slug} value={product.slug}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="productTitle" value={row.title} />

                <select
                  name="productSize"
                  value={row.size}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, at) =>
                        at === index ? { ...item, size: event.target.value } : item,
                      ),
                    )
                  }
                  aria-label={`Size for piece ${index + 1}`}
                  className={inputClass}
                >
                  <option value="">Size</option>
                  {(products.find((item) => item.slug === row.slug)?.sizes ?? []).map(
                    (size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ),
                  )}
                </select>

                <input
                  name="productQuantity"
                  type="number"
                  min={1}
                  max={MAX.productQuantity}
                  value={row.quantity}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, at) =>
                        at === index
                          ? { ...item, quantity: Number(event.target.value) || 1 }
                          : item,
                      ),
                    )
                  }
                  aria-label={`How many of piece ${index + 1}`}
                  className={`w-[110px] ${inputClass}`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setRows((current) => current.filter((_, at) => at !== index))
                  }
                  className="rounded-[3px] px-4 text-[13px] font-semibold text-ink-quiet hover:text-alert"
                >
                  Remove
                </button>
              </div>
            ))}

            {rows.length < MAX.products && (
              <button
                type="button"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    { slug: "", title: "", size: "", quantity: 1 },
                  ])
                }
                className="w-fit rounded-[2px] border border-field-line px-5 py-2.5 text-[13px] font-semibold text-ink-soft hover:border-brand hover:text-blue"
              >
                Add a piece
              </button>
            )}
          </div>
        </Row>

        <Row
          label="Wording for the back cover"
          name="backpageInformation"
          error={errors.backpageInformation}
          hint="Thanks to those who came, where the wake is being held, any donations in lieu of flowers. This is printed in the booklet."
        >
          <textarea
            id="backpageInformation"
            name="backpageInformation"
            rows={5}
            maxLength={MAX.longText}
            defaultValue={saved?.backpageInformation ?? ""}
            className={`${inputClass} font-sans ${errors.backpageInformation ? errorClass : ""}`}
          />
        </Row>

        <Row
          label="Notes for the design team"
          name="additionalNotes"
          error={errors.additionalNotes}
          hint="Anything you want us to know that is not printed in the booklet."
        >
          <textarea
            id="additionalNotes"
            name="additionalNotes"
            rows={4}
            maxLength={MAX.longText}
            defaultValue={saved?.additionalNotes ?? ""}
            className={`${inputClass} font-sans ${errors.additionalNotes ? errorClass : ""}`}
          />
        </Row>

        <label className="flex items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            name="callbackRequested"
            checked={callback}
            onChange={(event) => setCallback(event.target.checked)}
            className="size-4"
          />
          I would rather talk it through on the phone
        </label>

        {callback && (
          <Row
            label="The number to call"
            name="callbackPhone"
            error={errors.callbackPhone}
          >
            <input
              id="callbackPhone"
              name="callbackPhone"
              type="tel"
              maxLength={MAX.phone}
              defaultValue={saved?.callbackPhone ?? ""}
              className={`w-[260px] ${inputClass} ${errors.callbackPhone ? errorClass : ""}`}
            />
          </Row>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-8">
        <button
          type="submit"
          name="intent"
          value="submit"
          className="rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
        >
          Send the form
        </button>

        <button
          type="submit"
          name="intent"
          value="draft"
          className="rounded-[2px] border border-field-line px-6 py-3.5 text-sm font-semibold text-ink-soft hover:border-brand hover:text-blue"
        >
          Save and finish later
        </button>

        <p className="text-[13px] text-ink-quiet">
          Nothing is final until you send it.
        </p>
      </div>
    </form>
  );
}
