/** Shapes shared between the page and the form, kept free of server imports. */

export type ProductChoice = {
  slug: string;
  name: string;
  sizes: string[];
};

export type OrderFormRow = {
  status: "draft" | "submitted";
  branchName: string | null;
  arrangerName: string | null;
  deceasedName: string | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  ageOfDeceased: string | null;
  funeralDate: string | null;
  funeralTime: string | null;
  venueName: string | null;
  photoOption: string | null;
  numberOfPages: number | null;
  insidePagesStyle: string | null;
  quantity: number | null;
  bespokeDesign: boolean;
  bespokeDetails: string | null;
  photoQty: number | null;
  photoInstructions: string | null;
  /** Everything sent through. The two below are the pre-array form. */
  attachments: { key: string; name: string; size: number; type: string }[];
  attachmentKey: string | null;
  attachmentName: string | null;
  additionalProducts: {
    slug: string;
    title: string;
    size: string;
    quantity: number;
  }[];
  backpageInformation: string | null;
  additionalNotes: string | null;
  callbackRequested: boolean;
  callbackPhone: string | null;
};
