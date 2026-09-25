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
  attachments: 40,
  addressLine: 200,
  city: 120,
  postcode: 20,
  country: 120,
} as const;

export const PHOTO_OPTIONS = ["none", "colour", "bw"] as const;
export const INSIDE_PAGE_STYLES = ["bw", "match_cover"] as const;
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
  branchName: optionalText(MAX.name),
  arrangerName: optionalText(MAX.name),

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
  photoInstructions: optionalText(MAX.instructions),
  /**
   * Everything the family has sent through, not one file.
   *
   * Capped so a stuck uploader cannot write an unbounded array, but high
   * enough for a twenty-page booklet with a photograph on every page.
   */
  attachments: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(500),
        name: z.string().trim().min(1).max(300),
        size: z.number().int().nonnegative(),
        type: z.string().trim().max(120),
      }),
    )
    .max(MAX.attachments, `That is more than ${MAX.attachments} files.`)
    .default([]),

  additionalProducts: z
    .array(additionalProductSchema)
    .max(MAX.products, `That is more than ${MAX.products} lines.`)
    .default([]),
  backpageInformation: optionalText(MAX.longText),
  additionalNotes: optionalText(MAX.longText),
  callbackRequested: z.boolean(),
  callbackPhone: optionalText(MAX.phone),

  /**
   * Where the finished stationery goes.
   *
   * Optional while the form is a draft, like everything else here — someone
   * filling this in the week of a funeral should be able to save what they
   * have and come back. It is checked on submit instead, by
   * requiredForSubmission below, because a printed order with nowhere to go is
   * the one gap that costs the studio a reprint.
   */
  shippingName: optionalText(MAX.name),
  shippingLine1: optionalText(MAX.addressLine),
  shippingLine2: optionalText(MAX.addressLine),
  shippingCity: optionalText(MAX.city),
  shippingPostcode: optionalText(MAX.postcode),
  shippingCountry: optionalText(MAX.country),
});

/**
 * What has to be there before the form can be sent.
 *
 * Kept apart from the schema so a draft can be saved half-finished. Only the
 * address is enforced: the studio can chase a missing middle name, but it
 * cannot post a parcel to nowhere.
 */
export function missingForSubmission(
  values: OrderFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.shippingLine1) {
    errors.shippingLine1 = "We need somewhere to send the printing.";
  }
  if (!values.shippingCity) {
    errors.shippingCity = "Enter the town or city.";
  }
  if (!values.shippingPostcode) {
    errors.shippingPostcode = "Enter the postcode.";
  }

  return errors;
}

export type OrderFormValues = z.infer<typeof orderFormSchema>;

/**
 * Whether the form can still be changed.
 *
 * A sent form is not a closed one. Names get spelled wrong and service times
 * move right up to the week itself, and a correction should not need a phone
 * call. Once the order has left the studio the form stops being instructions
 * and becomes the record of what was printed, so editing stops there.
 */
const LOCKED = ["shipped", "delivered", "cancelled"] as const;

export function canEditOrderForm(orderStatus: string): boolean {
  return !(LOCKED as readonly string[]).includes(orderStatus);
}
