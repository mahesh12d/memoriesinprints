import { z } from "zod";
import { emailField } from "@/lib/validation";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const enquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: emailField,
  phone: optionalText(40),
  // Spelled out rather than derived, so the parsed value keeps the exact
  // union type the database column expects.
  category: z.enum(["funeral", "wedding", "celebration"], {
    message: "Choose a project type",
  }),
  userType: z.enum(["funeral_director", "celebrant", "client"], {
    message: "Tell us which of these you are",
  }),
  subject: z
    .string()
    .trim()
    .min(3, "Give your enquiry a short title")
    .max(200),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more so we can quote accurately")
    .max(4000),
  eventDate: optionalText(20),
  /**
   * An untouched number input submits "", which coerces to 0 and would fail
   * .positive() — so blank is normalised to undefined before coercion, and the
   * field is genuinely optional.
   */
  estimatedQuantity: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    z.coerce
      .number()
      .int()
      .positive("Enter a quantity of at least 1")
      .max(100_000)
      .optional(),
  ),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
