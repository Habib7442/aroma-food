import type { Metadata } from "next";

export const SITE_URL = "https://zaavo.co.in";
export const SITE_NAME = "Zaavo";
export const TAGLINE = "Silchar's best food, delivered fresh.";

export const DEFAULT_TITLE = "Zaavo — Food Delivery in Silchar, Assam";
export const DEFAULT_DESCRIPTION =
  "Order food online in Silchar with Zaavo. Browse local restaurants, get hot food delivered fast across Silchar, Assam, and pay with UPI, card, or cash on delivery.";

/**
 * Local-SEO keyword set, ordered by intent priority. Google mostly ignores
 * the <meta name="keywords"> tag itself, so these are also used to steer
 * page titles/descriptions/JSON-LD — that's what actually moves local
 * search ranking, not the meta tag alone.
 */
export const LOCAL_KEYWORDS = [
  "food delivery Silchar",
  "online food order Silchar",
  "order food online Silchar Assam",
  "Silchar food delivery app",
  "restaurants in Silchar",
  "Silchar restaurants near me",
  "best food delivery Assam",
  "home delivery food Silchar",
  "Cachar district food delivery",
  "Silchar online food ordering",
  "fast food delivery Silchar",
  "Zaavo Silchar",
  "Zaavo food delivery",
  "Assam food delivery service",
  "Link Road Silchar restaurants",
];

type BuildMetadataOptions = {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
};

/**
 * Per-page Metadata builder. Pass a page-specific title/description; local
 * keywords are always included since every page should reinforce the same
 * "Silchar food delivery" intent regardless of what page it is.
 */
export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  keywords = [],
}: BuildMetadataOptions): Metadata {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;

  return {
    title,
    description,
    keywords: [...LOCAL_KEYWORDS, ...keywords],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_IN",
      type: "website",
      images: [{ url: "/zaavo-og.jpg", width: 1200, height: 630, alt: TAGLINE }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/zaavo-og.jpg"],
    },
  };
}

/**
 * schema.org structured data for Google's local pack / rich results.
 * Contact details mirror the /contact page — keep them in sync.
 */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  image: `${SITE_URL}/zaavo-og.jpg`,
  description: DEFAULT_DESCRIPTION,
  email: "support@zaavo.co.in",
  telephone: "+91-7637989226",
  address: {
    "@type": "PostalAddress",
    streetAddress: "2nd Link Road",
    addressLocality: "Silchar",
    addressRegion: "Assam",
    postalCode: "788015",
    addressCountry: "IN",
  },
  areaServed: {
    "@type": "City",
    name: "Silchar",
  },
  sameAs: [],
};
