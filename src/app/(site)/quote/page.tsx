import { redirect } from "next/navigation";

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  if (product) {
    redirect(`/contact?product=${encodeURIComponent(product)}`);
  }
  redirect("/contact");
}
