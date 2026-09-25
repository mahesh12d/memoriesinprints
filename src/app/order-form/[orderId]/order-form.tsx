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

type UploadedFile = { key: string; name: string; size: number; type: string };
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
    /*
      A card on a grey page rather than a rule across a white one.

      This form is long, and read by someone who is not concentrating.
      Nine sections separated by hairlines run together; the same nine on
      their own white panels can be taken one at a time. The two tones are
      the ones the rest of the site already uses for a card on a page.
    */
    <section className="flex flex-col gap-6 rounded-md border border-line bg-card p-6 sm:p-9">
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
  orderId,
  addressDefaults,
  saved,
  products,
  alreadySent = false,
}: {
  orderId: string;
  /** Sent once already, so the buttons say so rather than asking again. */
  alreadySent?: boolean;
  /** The account's address, so the delivery block starts filled in. */
  addressDefaults: {
    shippingName: string;
    shippingLine1: string;
    shippingLine2: string;
    shippingCity: string;
    shippingPostcode: string;
    shippingCountry: string;
  };
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
  const [callback, setCallback] = useState(saved?.callbackRequested ?? false);

  /**
   * The address shows as one line, with the fields behind a button.
   *
   * Nearly every order goes to the branch it came from, so six boxes
   * already filled in are six things to read past. They open on their own
   * when there is no address to show, and when something in them is wrong.
   */
  const [editAddress, setEditAddress] = useState(
    !addressDefaults.shippingLine1,
  );

  const addressSummary =
    [
      addressDefaults.shippingName,
      addressDefaults.shippingLine1,
      addressDefaults.shippingLine2,
      addressDefaults.shippingCity,
      addressDefaults.shippingPostcode,
      addressDefaults.shippingCountry,
    ]
      .filter(Boolean)
      .join(", ") || "No address on your account yet.";

  // An address that failed validation has to be on screen to be fixed.
  const showAddressFields =
    editAddress ||
    Boolean(
      errors.shippingName ||
        errors.shippingLine1 ||
        errors.shippingLine2 ||
        errors.shippingCity ||
        errors.shippingPostcode ||
        errors.shippingCountry,
    );

  const [rows, setRows] = useState(saved?.additionalProducts ?? []);
  /**
   * Every file sent so far.
   *
   * Seeded from the array, falling back to the single attachment a form saved
   * before multiple files were allowed — otherwise reopening an older form
   * would silently lose what was already sent.
   */
  const [files, setFiles] = useState<UploadedFile[]>(() => {
    if (saved?.attachments?.length) return saved.attachments;
    if (saved?.attachmentKey) {
      return [
        {
          key: saved.attachmentKey,
          name: saved.attachmentName ?? "Attached file",
          size: 0,
          type: "",
        },
      ];
    }
    return [];
  });

  /** Files currently in flight, by name, so each row can speak for itself. */
  const [inFlight, setInFlight] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploading = inFlight.length > 0;

  /**
  /**
   * Sends one file to storage and returns what the form should remember.
   *
   * The bytes go straight to object storage rather than through the server
   * action, so a folder of photographs cannot time the submission out.
   */
  async function uploadOne(file: File): Promise<UploadedFile | null> {
    const ticket = await fetch(`/api/order-form/${orderId}/attachment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      }),
    }).then((response) => response.json());

    if (!ticket?.uploadUrl) {
      throw new Error(ticket?.error ?? "That file couldn't be sent.");
    }

    const put = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!put.ok) throw new Error("That file couldn't be sent.");

    return {
      key: ticket.storageKey,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }

  /**
   * Takes everything chosen at once.
   *
   * Uploaded one at a time rather than all in parallel: twenty photographs
   * fired together will saturate a phone's connection and are more likely to
   * fail together than to arrive faster. Each one that lands is kept even if
   * a later one fails, so nobody has to start the whole set again.
   */
  async function uploadMany(chosen: File[]) {
    setUploadError(null);
    setInFlight(chosen.map((file) => file.name));

    const failed: string[] = [];

    for (const file of chosen) {
      try {
        const done = await uploadOne(file);
        if (done) setFiles((current) => [...current, done]);
      } catch {
        failed.push(file.name);
      } finally {
        setInFlight((current) => current.filter((name) => name !== file.name));
      }
    }

    if (failed.length === 1) {
      setUploadError(`${failed[0]} couldn't be sent. Try it again.`);
    } else if (failed.length > 1) {
      setUploadError(
        `${failed.length} files couldn't be sent: ${failed.join(", ")}.`,
      );
    }
  }

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
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="orderId" value={orderId} />

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

      <Section title="The person being honoured">
        {/* Three across: the dates and the age belong on one line. */}
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="sm:col-span-3">
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
            <Row
              label="Church, crematorium, or venue"
              name="venueName"
              error={errors.venueName}
            >
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

      <Section
        title="Print specification"
        intro="The design, the paper it is printed on, and how many."
      >
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

        {/*
          Optional, and shaped like it: a tick that opens a box, rather than a
          field sitting open asking to be filled in. Most orders are a
          catalogue design, and an empty box on every one of them reads as
          something left undone.
        */}
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
            bespoke
              ? "border-brand bg-brand-tint"
              : "border-line bg-card hover:border-field-line"
          }`}
        >
          <input
            type="checkbox"
            name="bespokeDesign"
            checked={bespoke}
            onChange={(event) => setBespoke(event.target.checked)}
            className="mt-0.5 size-4 accent-[color:var(--color-brand-deep)]"
          />
          <span className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">
              I would like something designed specially
            </span>
            <span className="text-[13px] leading-relaxed text-ink-muted">
              Optional. Tick this and tell us what you have in mind, and a
              designer will work from your description rather than a catalogue
              design.
            </span>
          </span>
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

      {bespoke && (
        <Section
          title="Additional products"
          intro="Keepsakes to go alongside the booklet, in the same design."
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
                  /*
                    minmax(0,…) on both selects, or they refuse to shrink:
                    a grid column is auto-sized to its content by default,
                    so "A1 — 594 x 841mm" pushed the size box wider than
                    its share and the text was cut off mid-word.
                  */
                  className="grid gap-3 rounded-[3px] border border-line bg-surface-grey p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_96px_auto]"
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
                    className={`min-w-0 ${inputClass}`}
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
                    title={row.size || undefined}
                    className={`min-w-0 ${inputClass}`}
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
                    className={`w-full min-w-0 ${inputClass}`}
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
        </Section>
      )}

      <Section
        title="Photographs"
        intro="Add them below and they come straight through to the studio."
      >
        {/*
          The allowance, stated before the field that counts them.
          It is on the studio's paper form and it is the one thing here that
          changes the price, so someone should not have to be told afterwards.
        */}
        <p className="rounded-[4px] bg-surface-grey px-[14px] py-3 text-[13px] leading-relaxed text-ink-soft">
          Two photographs are included in the price. Any more are &pound;5.00
          each, and we will confirm the total with you before printing.
        </p>

        <div>
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
      </Section>

      <Section
        title="Inside information"
        intro="The running order, readings, and anything the design team should know."
      >
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

      <Section
        title="Backpage information"
        intro="What goes on the back cover of the booklet."
      >
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
      </Section>

      <Section
        title="Attachments"
        intro="Photographs, artwork or a PDF to go with this order — as many as you need."
      >
        <input
          type="hidden"
          name="attachments"
          value={JSON.stringify(files)}
        />

        <Row
          label="Photographs and artwork"
          name="attachment"
          hint="Add as many as you need — the cover, the inside pages, the back. JPEG, PNG, WebP or PDF, up to 25MB each."
        >
          <div className="flex flex-col gap-4">
            {/*
              A label styled as a drop area rather than a bare file input.
              The input itself stays in the DOM and keyboard-reachable; only
              its default appearance is replaced, so focus and the file picker
              behave exactly as the browser intends.
            */}
            <label
              htmlFor="attachment"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-field-line bg-surface-grey/40 px-6 py-8 text-center transition-colors hover:border-brand hover:bg-brand-tint/40"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-7 w-7 text-ink-pale"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V4" />
                <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
                <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
              </svg>
              <span className="text-sm font-semibold text-ink-soft">
                Choose files
              </span>
              <span className="text-[12px] text-ink-quiet">
                You can select several at once
              </span>
            </label>

            <input
              id="attachment"
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              onChange={(event) => {
                const chosen = Array.from(event.target.files ?? []);
                // Cleared so choosing the same file twice still fires.
                event.target.value = "";
                if (chosen.length) void uploadMany(chosen);
              }}
              className="sr-only"
            />

            {(files.length > 0 || inFlight.length > 0) && (
              <ul
                aria-label="Attached files"
                aria-busy={uploading}
                className="flex flex-col divide-y divide-line-soft rounded-md border border-line"
              >
                {files.map((file) => (
                  <li
                    key={file.key}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="text-good-deep" aria-hidden="true">
                        <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.5 5 9l4.5-5" />
                        </svg>
                      </span>
                      <span className="truncate text-[13px]">{file.name}</span>
                      {file.size > 0 && (
                        <span className="shrink-0 text-[12px] text-ink-quiet">
                          {Math.max(1, Math.round(file.size / 1024))} KB
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((row) => row.key !== file.key),
                        )
                      }
                      className="shrink-0 text-[12px] font-semibold text-ink-quiet hover:text-alert hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}

                {inFlight.map((name) => (
                  <li
                    key={`sending-${name}`}
                    className="flex items-center gap-2.5 px-4 py-3"
                  >
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand"
                    />
                    <span className="truncate text-[13px] text-ink-muted">
                      Sending {name}…
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {files.length > 0 && !uploading && (
              <p role="status" className="text-[12px] text-ink-quiet">
                {files.length === 1
                  ? "1 file attached."
                  : `${files.length} files attached.`}
              </p>
            )}

            {uploadError && (
              <p className="text-[13px] font-semibold text-alert" role="alert">
                {uploadError}
              </p>
            )}
          </div>
        </Row>
      </Section>

      {/*
        Where it goes, as its own block at the end of the form.

        Filled in from the account already, because a funeral director sends
        nearly everything to the same place — but editable, because the order
        that goes to a family's house instead is exactly the one nobody wants
        to get wrong. Editing here changes this order only; the account
        address is left alone.
      */}
      <Section
        title="Shipment"
        intro="Taken from your account. Change it if this order is going somewhere else."
      >
        {!showAddressFields && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] bg-surface-grey px-[18px] py-4">
            <p className="text-[15px] leading-relaxed">{addressSummary}</p>
            <button
              type="button"
              onClick={() => setEditAddress(true)}
              className="rounded-[2px] border border-field-line bg-card px-5 py-2.5 text-[13px] font-semibold text-ink-soft hover:border-brand hover:text-blue"
            >
              Send it somewhere else
            </button>
          </div>
        )}

        {/*
          Hidden with a class rather than unmounted: the inputs stay in the
          form, so the address still posts whether or not anyone opened this.
        */}
        <div className={showAddressFields ? "flex flex-col gap-6" : "hidden"}>
        <Row label="Addressed to" name="shippingName" error={errors.shippingName}>
          <input
            id="shippingName"
            name="shippingName"
            autoComplete="name"
            maxLength={200}
            defaultValue={addressDefaults.shippingName}
            className={`${inputClass} ${errors.shippingName ? errorClass : ""}`}
          />
        </Row>

        <Row label="Address" name="shippingLine1" error={errors.shippingLine1}>
          <input
            id="shippingLine1"
            name="shippingLine1"
            autoComplete="address-line1"
            maxLength={200}
            defaultValue={addressDefaults.shippingLine1}
            className={`${inputClass} ${errors.shippingLine1 ? errorClass : ""}`}
          />
        </Row>

        <Row label="Address line 2" name="shippingLine2" error={errors.shippingLine2}>
          <input
            id="shippingLine2"
            name="shippingLine2"
            autoComplete="address-line2"
            maxLength={200}
            defaultValue={addressDefaults.shippingLine2}
            className={`${inputClass} ${errors.shippingLine2 ? errorClass : ""}`}
          />
        </Row>

        <Row label="Town or city" name="shippingCity" error={errors.shippingCity}>
          <input
            id="shippingCity"
            name="shippingCity"
            autoComplete="address-level2"
            maxLength={120}
            defaultValue={addressDefaults.shippingCity}
            className={`w-[320px] ${inputClass} ${errors.shippingCity ? errorClass : ""}`}
          />
        </Row>

        <Row label="Postcode" name="shippingPostcode" error={errors.shippingPostcode}>
          <input
            id="shippingPostcode"
            name="shippingPostcode"
            autoComplete="postal-code"
            maxLength={20}
            defaultValue={addressDefaults.shippingPostcode}
            className={`w-[200px] ${inputClass} ${errors.shippingPostcode ? errorClass : ""}`}
          />
        </Row>

        <Row label="Country" name="shippingCountry" error={errors.shippingCountry}>
          <input
            id="shippingCountry"
            name="shippingCountry"
            autoComplete="country-name"
            maxLength={120}
            defaultValue={addressDefaults.shippingCountry}
            className={`w-[320px] ${inputClass} ${errors.shippingCountry ? errorClass : ""}`}
          />
        </Row>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-4 rounded-md border border-line bg-card p-6 sm:p-9">
        <button
          type="submit"
          name="intent"
          value="submit"
          className="rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
        >
          {alreadySent ? "Send the changes" : "Send the form"}
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
          {alreadySent
            ? "Your changes reach the design team as soon as you send them."
            : "Nothing is final until you send it."}
        </p>
      </div>
    </form>
  );
}
