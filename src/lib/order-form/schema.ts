import { z } from "zod";

/**
 * What the order form accepts.
 *
 * Kept free of server imports so the page, the client form and the action all
 * measure against the same rules — the limits below are what the inputs put
 * in their `maxlength` and `max` attributes, so the browser stops most
 * mistakes before a round trip and the server stops the rest.
 *
 * Every field is optional. The form is saved as a draft as often as someone
 * needs, and nothing is required until they choose to send it: a family part
 * way through arranging a funeral often does not yet know the time, or the
 * final head count.
 */

export const MAX = {
  name: 200,
  venue: 300,
  time: 60,
  age: 60,
  phone: 60,
  instructions: 2000,
  longText: 5000,
  photoQty: 1000,
  products: 50,
  productQuantity: 10_000,
} as const;

export const PHOTO_OPTIONS = ["none", "colour", "bw"] as const;
export const INSIDE_PAGE_STYLES = ["bw", "match_cover"] as const;
export const PHOTO_SUPPLIED_VIA = ["email", "post"] as const;
export const PAGE_COUNTS = [4, 8, 12, 16] as const;

/** Offered as buttons; any number at or above the minimum is still accepted. */
export const QUANTITY_PRESETS = [20, 25, 30, 40, 50, 75, 100, 150, 200] as const;
export const MIN_QUANTITY = 20;
export const DEFAULT_QUANTITY = 50;

/** An empty field means "not answered yet", never an empty string in the row. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .transform((value) => value || null)
    .nullable();

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker, or type it as YYYY-MM-DD.")
  .or(z.literal(""))
  .transform((value) => value || null)
  .nullable();

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .enum(values)
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : (value as T[number])))
    .nullable();

export const additionalProductSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  size: z.string().trim().max(120).default(""),
  quantity: z.coerce
    .number()
    .int("Whole numbers only.")
    .min(1, "At least one.")
    .max(MAX.productQuantity, `At most ${MAX.productQuantity}.`),
});

export const orderFormSchema = z.object({
  deceasedName: optionalText(MAX.name),
  dateOfBirth: optionalDate,
  dateOfDeath: optionalDate,
  ageOfDeceased: optionalText(MAX.age),

  funeralDate: optionalDate,
  funeralTime: optionalText(MAX.time),
  venueName: optionalText(MAX.venue),

  photoOption: optionalEnum(PHOTO_OPTIONS),
  numberOfPages: z
    .union([z.literal(""), z.coerce.number().int()])
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .refine(
      (value) =>
        value === null || PAGE_COUNTS.includes(value as (typeof PAGE_COUNTS)[number]),
      { message: "Choose 4, 8, 12 or 16 pages." },
    ),
  insidePagesStyle: optionalEnum(INSIDE_PAGE_STYLES),
  quantity: z
    .union([z.literal(""), z.coerce.number().int()])
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .refine((value) => value === null || value >= MIN_QUANTITY, {
      message: `The smallest run we print is ${MIN_QUANTITY}.`,
    }),
  bespokeDesign: z.boolean(),
  bespokeDetails: optionalText(MAX.longText),

  photoQty: z
    .union([z.literal(""), z.coerce.number().int()])
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .refine(
      (value) => value === null || (value >= 0 && value <= MAX.photoQty),
      { message: `A number between 0 and ${MAX.photoQty}.` },
    ),
  photoSuppliedVia: optionalEnum(PHOTO_SUPPLIED_VIA),
  photoInstructions: optionalText(MAX.instructions),
  attachmentKey: z.string().trim().max(500).nullable().default(null),
  attachmentName: z.string().trim().max(300).nullable().default(null),

  additionalProducts: z
    .array(additionalProductSchema)
    .max(MAX.products, `That is more than ${MAX.products} lines.`)
    .default([]),
  backpageInformation: optionalText(MAX.longText),
  additionalNotes: optionalText(MAX.longText),
  callbackRequested: z.boolean(),
  callbackPhone: optionalText(MAX.phone),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;
