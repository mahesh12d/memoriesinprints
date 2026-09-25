import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditOrderForm,
  MAX,
  MIN_QUANTITY,
  missingForSubmission,
  orderFormSchema,
} from "./schema";

/**
 * The form is filled in a few sittings by someone who has just been bereaved,
 * so "everything is optional until you send it" is the rule that matters
 * most. These assert it holds, and that the limits still bite.
 */

/** An untouched form: every field blank, as the browser posts it. */
const blank = {
  branchName: "",
  arrangerName: "",
  deceasedName: "",
  dateOfBirth: "",
  dateOfDeath: "",
  ageOfDeceased: "",
  funeralDate: "",
  funeralTime: "",
  venueName: "",
  photoOption: "",
  numberOfPages: "",
  insidePagesStyle: "",
  quantity: "",
  bespokeDesign: false,
  bespokeDetails: "",
  photoQty: "",
  photoInstructions: "",
  attachmentKey: null,
  attachmentName: null,
  additionalProducts: [],
  backpageInformation: "",
  additionalNotes: "",
  callbackRequested: false,
  callbackPhone: "",
  shippingName: "",
  shippingLine1: "",
  shippingLine2: "",
  shippingCity: "",
  shippingPostcode: "",
  shippingCountry: "",
};

test("an empty form is valid, and blanks become null rather than empty strings", () => {
  const result = orderFormSchema.safeParse(blank);

  assert.equal(result.success, true);
  assert.equal(result.data?.deceasedName, null);
  assert.equal(result.data?.funeralDate, null);
  assert.equal(result.data?.photoOption, null);
  assert.equal(result.data?.quantity, null);
});

test("enums take only the listed values", () => {
  assert.equal(
    orderFormSchema.safeParse({ ...blank, photoOption: "colour" }).success,
    true,
  );
  assert.equal(
    orderFormSchema.safeParse({ ...blank, photoOption: "sepia" }).success,
    false,
  );
  assert.equal(
    orderFormSchema.safeParse({ ...blank, insidePagesStyle: "match_cover" })
      .success,
    true,
  );
  assert.equal(
    orderFormSchema.safeParse({ ...blank, photoOption: "sepia" }).success,
    false,
  );
});

test("page count is one of the four the studio binds", () => {
  for (const pages of [4, 8, 12, 16]) {
    assert.equal(
      orderFormSchema.safeParse({ ...blank, numberOfPages: pages }).success,
      true,
      `${pages} pages should be allowed`,
    );
  }
  assert.equal(
    orderFormSchema.safeParse({ ...blank, numberOfPages: 6 }).success,
    false,
  );
});

test("a run below the minimum is refused, the minimum itself is not", () => {
  assert.equal(
    orderFormSchema.safeParse({ ...blank, quantity: MIN_QUANTITY - 1 }).success,
    false,
  );
  assert.equal(
    orderFormSchema.safeParse({ ...blank, quantity: MIN_QUANTITY }).success,
    true,
  );
});

test("photo count stays within 0 and 1000", () => {
  assert.equal(orderFormSchema.safeParse({ ...blank, photoQty: 0 }).success, true);
  assert.equal(
    orderFormSchema.safeParse({ ...blank, photoQty: MAX.photoQty }).success,
    true,
  );
  assert.equal(
    orderFormSchema.safeParse({ ...blank, photoQty: MAX.photoQty + 1 }).success,
    false,
  );
  assert.equal(orderFormSchema.safeParse({ ...blank, photoQty: -1 }).success, false);
});

test("long text is capped so one paste cannot fill the column", () => {
  assert.equal(
    orderFormSchema.safeParse({
      ...blank,
      additionalNotes: "a".repeat(MAX.longText),
    }).success,
    true,
  );
  assert.equal(
    orderFormSchema.safeParse({
      ...blank,
      additionalNotes: "a".repeat(MAX.longText + 1),
    }).success,
    false,
  );
  assert.equal(
    orderFormSchema.safeParse({ ...blank, deceasedName: "a".repeat(201) })
      .success,
    false,
  );
});

test("extra product rows are limited in number and in quantity", () => {
  const row = { slug: "order-of-service", title: "Order of service", size: "A5", quantity: 10 };

  assert.equal(
    orderFormSchema.safeParse({
      ...blank,
      additionalProducts: Array.from({ length: MAX.products }, () => row),
    }).success,
    true,
  );
  assert.equal(
    orderFormSchema.safeParse({
      ...blank,
      additionalProducts: Array.from({ length: MAX.products + 1 }, () => row),
    }).success,
    false,
  );
  assert.equal(
    orderFormSchema.safeParse({
      ...blank,
      additionalProducts: [{ ...row, quantity: MAX.productQuantity + 1 }],
    }).success,
    false,
  );
  assert.equal(
    orderFormSchema.safeParse({
      ...blank,
      additionalProducts: [{ ...row, quantity: 0 }],
    }).success,
    false,
  );
});

test("the back cover wording and the design notes stay separate fields", () => {
  const result = orderFormSchema.safeParse({
    ...blank,
    backpageInformation: "Donations to the hospice, in lieu of flowers.",
    additionalNotes: "Her name is spelled Ellen, not Elaine.",
  });

  assert.equal(result.success, true);
  assert.equal(
    result.data?.backpageInformation,
    "Donations to the hospice, in lieu of flowers.",
  );
  assert.equal(
    result.data?.additionalNotes,
    "Her name is spelled Ellen, not Elaine.",
  );
});

/**
 * The address is the one thing the studio cannot work around.
 *
 * It stays optional while the form is a draft — someone filling this in the
 * week of a funeral must be able to save half of it — but a form cannot be
 * sent without somewhere to post the printing to.
 */
test("a draft may have no address at all", () => {
  const result = orderFormSchema.safeParse(blank);
  assert.equal(result.success, true, "a blank form is still a valid draft");
});

test("sending without an address is refused, field by field", () => {
  const values = orderFormSchema.parse(blank);
  const missing = missingForSubmission(values);

  assert.ok(missing.shippingLine1, "the street is named as missing");
  assert.ok(missing.shippingCity, "the town is named as missing");
  assert.ok(missing.shippingPostcode, "the postcode is named as missing");
});

test("a complete address clears the way to send", () => {
  const values = orderFormSchema.parse({
    ...blank,
    shippingName: "Jordan Ellis",
    shippingLine1: "12 Chapel Row",
    shippingCity: "Bristol",
    shippingPostcode: "BS1 4XX",
  });

  assert.deepEqual(missingForSubmission(values), {});
});

test("line 2 and country are not insisted on", () => {
  // Plenty of addresses have no second line, and the country defaults.
  const values = orderFormSchema.parse({
    ...blank,
    shippingLine1: "12 Chapel Row",
    shippingCity: "Bristol",
    shippingPostcode: "BS1 4XX",
  });

  assert.equal(values.shippingLine2, null);
  assert.deepEqual(missingForSubmission(values), {});
});

test("a sent form stays editable until the order leaves the studio", () => {
  assert.equal(canEditOrderForm("awaiting_proof"), true);
  assert.equal(canEditOrderForm("awaiting_payment"), true);
  assert.equal(canEditOrderForm("in_production"), true);

  assert.equal(canEditOrderForm("shipped"), false);
  assert.equal(canEditOrderForm("delivered"), false);
  assert.equal(canEditOrderForm("cancelled"), false);
});
