"use client";

import { useActionState } from "react";
import { emptyFormState, type FormState } from "@/lib/auth/form-state";
import { CATEGORY } from "@/lib/admin/labels";
import { FormMessage, SelectField, SubmitButton } from "@/components/ui/form";

const fieldClass =
  "w-full rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm";

const fileClass =
  "rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm file:mr-3 file:rounded-[2px] file:border-0 file:bg-surface-grey file:px-3 file:py-1.5 file:text-[13px] file:font-semibold";

export type ProductValues = {
  id?: string;
  name: string;
  category: string;
  summary: string | null;
  description: string | null;
  minimumQuantity: number;
  sortOrder: number;
  isActive: boolean;
};

/**
 * One form for both creating and editing.
 *
 * The image field is left empty on an edit on purpose: choosing nothing keeps
 * the picture that is already there, rather than blanking it because the file
 * input came back empty.
 */
export function ProductForm({
  action,
  values,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: ProductValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormMessage state={state} />
      {values.id && <input type="hidden" name="productId" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">Name</span>
          <input
            name="name"
            required
            defaultValue={values.name}
            placeholder="Order of service booklet"
            className={fieldClass}
          />
        </label>

        <SelectField
          id="category"
          label="Category"
          name="category"
          defaultValue={values.category}
        >
          {Object.entries(CATEGORY).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Smallest order we take
          </span>
          <input
            name="minimumQuantity"
            type="number"
            min="1"
            defaultValue={values.minimumQuantity}
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            One-line summary
          </span>
          <input
            name="summary"
            defaultValue={values.summary ?? ""}
            placeholder="An eight-page booklet on 170gsm silk, folded and stitched."
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Full description
          </span>
          <textarea
            name="description"
            rows={5}
            defaultValue={values.description ?? ""}
            className={`${fieldClass} font-sans`}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Photograph
          </span>
          <input type="file" name="image" accept="image/*" className={fileClass} />
          <span className="text-[12px] text-ink-quiet">
            {values.id
              ? "Leave empty to keep the current picture."
              : "JPEG, PNG or WebP."}
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Where it sits in the list
          </span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={values.sortOrder}
            className={fieldClass}
          />
          <span className="text-[12px] text-ink-quiet">
            Lower numbers come first.
          </span>
        </label>
      </div>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={values.isActive}
          className="size-4"
        />
        <span className="text-[13px] font-semibold text-ink-soft">
          Show this on the website
        </span>
      </label>

      <SubmitButton className="self-start" pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export type PortfolioValues = {
  id?: string;
  title: string;
  category: string;
  description: string | null;
  templateNumber: number | null;
  style: string | null;
  isPopular: boolean;
  sortOrder: number;
  isPublished: boolean;
};

export function PortfolioForm({
  action,
  values,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values: PortfolioValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormMessage state={state} />
      {values.id && <input type="hidden" name="itemId" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">Title</span>
          <input
            name="title"
            required
            defaultValue={values.title}
            placeholder="Foiled wedding suite in sage and ivory"
            className={fieldClass}
          />
        </label>

        <SelectField
          id="category"
          label="Category"
          name="category"
          defaultValue={values.category}
        >
          {Object.entries(CATEGORY).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Template number
          </span>
          <input
            name="templateNumber"
            type="number"
            min="1"
            defaultValue={values.templateNumber ?? ""}
            placeholder="e.g. 104"
            className={fieldClass}
          />
          <span className="text-[12px] text-ink-quiet">
            The studio&rsquo;s own number for this design. No two pieces share
            one.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Where it sits in the list
          </span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={values.sortOrder}
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">Style</span>
          <input
            name="style"
            list="portfolio-styles"
            defaultValue={values.style ?? ""}
            placeholder="Classic"
            className={fieldClass}
          />
          <datalist id="portfolio-styles">
            {["Classic", "Floral", "Landscape", "Playful", "Religious"].map(
              (option) => (
                <option key={option} value={option} />
              ),
            )}
          </datalist>
          <span className="text-[12px] text-ink-quiet">
            One word. It becomes a filter chip on the portfolio page, and a
            word nobody has used yet makes a new chip.
          </span>
        </label>

        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            About the piece
          </span>
          <textarea
            name="description"
            rows={4}
            defaultValue={values.description ?? ""}
            className={`${fieldClass} font-sans`}
          />
        </label>

        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Photograph
          </span>
          <input type="file" name="image" accept="image/*" className={fileClass} />
          <span className="text-[12px] text-ink-quiet">
            {values.id
              ? "Leave empty to keep the current picture."
              : "JPEG, PNG or WebP."}
          </span>
        </label>
      </div>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="isPopular"
          defaultChecked={values.isPopular}
          className="size-4"
        />
        <span className="text-[13px] text-ink-soft">
          Show under the Popular filter
        </span>
      </label>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={values.isPublished}
          className="size-4"
        />
        <span className="text-[13px] font-semibold text-ink-soft">
          Show this in the portfolio
        </span>
      </label>

      <SubmitButton className="self-start" pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export function SizeForm({
  productId,
  action,
}: {
  productId: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="productId" value={productId} />

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">Size</span>
          <input
            name="label"
            required
            placeholder="A5 booklet"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Width (mm)
          </span>
          <input name="widthMm" type="number" min="1" className={fieldClass} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-soft">
            Height (mm)
          </span>
          <input name="heightMm" type="number" min="1" className={fieldClass} />
        </label>
      </div>

      <SubmitButton className="self-start" variant="secondary" pendingLabel="Adding…">
        Add this size
      </SubmitButton>
    </form>
  );
}
