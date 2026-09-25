import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  customerItemPrices,
  portfolioItemPrices,
  portfolioItems,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { CATEGORY_LABEL } from "@/lib/catalogue";
import { resolveImageUrl, resolveImageUrls } from "@/lib/storage/image-url";
import { loadSavedTemplateIds } from "@/lib/saved/queries";
import { Breadcrumb, CtaBand, Section } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { SaveButton } from "@/components/site/save-button";
import { TemplatePurchase } from "./template-purchase";

async function loadItem(slug: string) {
  const [item] = await db
    .select({
      id: portfolioItems.id,
      slug: portfolioItems.slug,
      title: portfolioItems.title,
      category: portfolioItems.category,
      description: portfolioItems.description,
      imageUrl: portfolioItems.imageUrl,
      templateNumber: portfolioItems.templateNumber,
      style: portfolioItems.style,
      isPopular: portfolioItems.isPopular,
      amountMinor: portfolioItemPrices.amountMinor,
      currency: portfolioItemPrices.currency,
      priceActive: portfolioItemPrices.isActive,
    })
    .from(portfolioItems)
    .leftJoin(
      portfolioItemPrices,
      eq(portfolioItemPrices.portfolioItemId, portfolioItems.id),
    )
    .where(
      and(eq(portfolioItems.slug, slug), eq(portfolioItems.isPublished, true)),
    )
    .limit(1);

  return item ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await loadItem(slug);

  if (!item) return { title: "Design not found" };

  return {
    title: item.title,
    description:
      item.description ??
      `${item.title} — ${CATEGORY_LABEL[item.category]} stationery from the Memories in Prints studio.`,
  };
}

export default async function PortfolioItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await loadItem(slug);

  if (!item) notFound();

  const [imageUrl, saved] = await Promise.all([
    resolveImageUrl(item.imageUrl),
    loadSavedTemplateIds(),
  ]);

  /**
   * Designs from the same category, shown as a way onward rather than as a
   * recommendation — the studio has no ranking to offer and inventing one
   * would be a lie about how a bereaved family should choose.
   */
  const alsoIn = await db
    .select({
      id: portfolioItems.id,
      slug: portfolioItems.slug,
      title: portfolioItems.title,
      imageUrl: portfolioItems.imageUrl,
      templateNumber: portfolioItems.templateNumber,
    })
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.isPublished, true),
        eq(portfolioItems.category, item.category),
        ne(portfolioItems.id, item.id),
      ),
    )
    .orderBy(asc(portfolioItems.sortOrder))
    .limit(3);

  const alsoImages = await resolveImageUrls(alsoIn.map((row) => row.imageUrl));

  /**
   * A price only counts when the studio has left it switched on — and a rate
   * agreed with this particular customer beats the list price.
   *
   * The page used to join portfolioItemPrices alone, so a funeral director
   * with negotiated rates was quoted the list price here, added to cart at
   * their own rate, and found the basket disagreeing with the page they had
   * just been reading. The cart was right; this page was not.
   */
  const session = await getSession("site");

  const [agreed] = session
    ? await db
      .select({
        amountMinor: customerItemPrices.amountMinor,
        currency: customerItemPrices.currency,
      })
      .from(customerItemPrices)
      .where(
        and(
          eq(customerItemPrices.userId, session.user.id),
          eq(customerItemPrices.portfolioItemId, item.id),
          eq(customerItemPrices.isActive, true),
        ),
      )
      .limit(1)
    : [];

  const price = agreed
    ? { amountMinor: agreed.amountMinor, currency: agreed.currency ?? "GBP" }
    : item.amountMinor !== null && item.priceActive
      ? { amountMinor: item.amountMinor, currency: item.currency ?? "GBP" }
      : null;

  const here = `/portfolio/${item.slug}`;
  const categoryHref = `/portfolio?category=${item.category}`;

  return (
    <>
      <Section>
        <Breadcrumb
          trail={[
            { href: "/", label: "Home" },
            { href: "/portfolio", label: "Designs" },
            { href: categoryHref, label: CATEGORY_LABEL[item.category] },
            { label: item.title },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <ImagePlaceholder
            caption={`[Photograph — ${item.title.toLowerCase()}]`}
            src={imageUrl}
            className="aspect-[1142/1600] w-full rounded-md"
          />

          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <h1 className="text-[36px] leading-tight">{item.title}</h1>

              <ul className="flex flex-wrap items-center gap-2">
                {item.templateNumber !== null && (
                  <li className="rounded-full border border-line px-3.5 py-1.5 text-[12px] font-medium text-ink-muted">
                    Template no. {item.templateNumber}
                  </li>
                )}
                {item.style && (
                  <li>
                    <Link
                      href={`/portfolio?category=${item.category}&style=${encodeURIComponent(item.style)}`}
                      className="inline-flex rounded-full border border-line px-3.5 py-1.5 text-[12px] font-medium text-ink-muted hover:border-brand hover:text-blue"
                    >
                      {item.style}
                    </Link>
                  </li>
                )}
                {item.isPopular && (
                  <li className="rounded-full bg-brand-tint px-3.5 py-1.5 text-[12px] font-semibold text-brand-deep">
                    Popular
                  </li>
                )}
              </ul>
            </div>

            {item.description && (
              <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-muted">
                {item.description}
              </p>
            )}

            <TemplatePurchase
              itemKey={item.id}
              price={price}
              quoteHref={`/quote?design=${item.slug}`}
            />

            <div className="border-t border-line pt-6">
              <SaveButton
                portfolioItemId={item.id}
                productName={item.title}
                isSaved={saved.has(item.id)}
                returnTo={here}
                variant="inline"
                savedLabel="Template saved"
                unsavedLabel="Save this template"
              />
              <p className="mt-2.5 max-w-[46ch] text-[12px] leading-relaxed text-ink-quiet">
                Keeps it in your account so you can find it again, or send the
                number to the studio when you call.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {alsoIn.length > 0 && (
        <Section tone="grey">
          <h2 className="mb-8 text-[26px]">
            More {CATEGORY_LABEL[item.category].toLowerCase()} designs
          </h2>

          <ul className="grid gap-6 sm:grid-cols-3">
            {alsoIn.map((other, index) => (
              <li key={other.id}>
                <Link
                  href={`/portfolio/${other.slug}`}
                  className="group flex flex-col gap-3"
                >
                  <ImagePlaceholder
                    caption={`[Photograph — ${other.title.toLowerCase()}]`}
                    src={alsoImages[index]}
                    className="aspect-[1142/1600] w-full rounded-md"
                  />
                  <h3 className="font-display text-lg group-hover:text-blue">
                    {other.title}
                  </h3>
                  {other.templateNumber !== null && (
                    <p className="text-[12px] text-ink-quiet">
                      Template no. {other.templateNumber}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CtaBand
        title="Want It Changed?"
        body="Any design here can be reworked around your own photographs, wording and colours. Tell us what you have in mind."
        primary={{ href: `/quote?design=${item.slug}`, label: "Ask the studio" }}
        secondary={{ href: "/portfolio", label: "Back to the portfolio" }}
      />
    </>
  );
}
