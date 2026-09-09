import type { Metadata } from "next";

// Central SEO config + helpers for the public marketing site.
// Override the real domain with NEXT_PUBLIC_SITE_URL when deploying.

export const SITE_NAME = "MediFlow IQ";
export const SITE_TAGLINE = "Pharmacy Management, Simplified.";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mediflow.vercel.app";
export const SITE_DESCRIPTION =
  "MediFlow IQ is a modern pharmacy and drug-shop management system for sales, inventory, purchasing, customers, suppliers, expenses and reports — one connected platform.";
export const OG_IMAGE = "/Mediflow IQ logo.png";
export const OG_IMAGE_DIMENSIONS = { width: 1254, height: 1254 };
export const CONTACT_PHONES = ["0759327843", "0768082948"] as const;

export function siteUrl(path = ""): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

export function absoluteImage(src: string): string {
  return src.startsWith("http") ? src : siteUrl(src);
}

interface BuildMetadataArgs {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  image?: string;
}

// Page-level metadata: builds canonical, OpenGraph, Twitter and robots tags
// consistently. The title is composed with the brand so <title> reads
// "… — MediFlow IQ" (matches the root title template).
export function buildMetadata({
  title,
  description,
  path,
  keywords,
  noIndex,
  image = OG_IMAGE,
}: BuildMetadataArgs): Metadata {
  const url = siteUrl(path);
  const img = absoluteImage(image);
  // The root layout owns the "%s — MediFlow IQ" title template, so the browser
  // <title> is composed automatically from the bare `title`. OG/Twitter do not
  // get the template applied, so they use the fully-branded version explicitly.
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_UG",
      type: "website",
      images: [
        {
          url: img,
          width: OG_IMAGE_DIMENSIONS.width,
          height: OG_IMAGE_DIMENSIONS.height,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [img],
    },
    robots: noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
  };
}

// Structured data (JSON-LD) for rich results. Render in a server component.
export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteImage(OG_IMAGE),
    description: SITE_DESCRIPTION,
    slogan: SITE_TAGLINE,
    contactPoint: CONTACT_PHONES.map((phone) => ({
      "@type": "ContactPoint",
      telephone: `+256${phone.slice(1)}`,
      contactType: "customer service",
      areaServed: "UG",
      availableLanguage: "English",
    })),
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}