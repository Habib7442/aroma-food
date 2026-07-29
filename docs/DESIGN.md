---
name: Premium Regional Gastronomy
colors:
  surface: '#f9faf4'
  surface-dim: '#d9dad5'
  surface-bright: '#f9faf4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4ef'
  surface-container: '#edeee9'
  surface-container-high: '#e8e9e3'
  surface-container-highest: '#e2e3de'
  on-surface: '#1a1c19'
  on-surface-variant: '#424941'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f0f1ec'
  outline: '#727970'
  outline-variant: '#c1c9be'
  surface-tint: '#3e6844'
  primary: '#032f12'
  on-primary: '#ffffff'
  primary-container: '#1d4626'
  on-primary-container: '#87b48b'
  inverse-primary: '#a4d2a7'
  secondary: '#835400'
  on-secondary: '#ffffff'
  secondary-container: '#feae32'
  on-secondary-container: '#6c4500'
  tertiary: '#002f16'
  on-tertiary: '#ffffff'
  tertiary-container: '#004825'
  on-tertiary-container: '#52bd7a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bfeec1'
  primary-fixed-dim: '#a4d2a7'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#264f2e'
  secondary-fixed: '#ffddb5'
  secondary-fixed-dim: '#ffb957'
  on-secondary-fixed: '#2a1800'
  on-secondary-fixed-variant: '#643f00'
  tertiary-fixed: '#8ef9b0'
  tertiary-fixed-dim: '#71dc95'
  on-tertiary-fixed: '#00210e'
  on-tertiary-fixed-variant: '#00522b'
  background: '#f9faf4'
  on-background: '#1a1c19'
  surface-variant: '#e2e3de'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  price-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
  price-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  baseline: 4px
  margin-side: 20px
  gutter: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  section-gap: 40px
---

## Brand & Style
The design system is engineered for a premium food delivery experience catering to discerning palates in mid-sized Indian urban centers. The brand personality is sophisticated yet rooted, blending high-end editorial aesthetics with regional warmth. 

The visual style leans into **Minimalism** with a **Tactile** edge, prioritizing breathability and high-quality food photography. By utilizing a restricted color palette and generous white space, the UI recedes to let the vibrant colors of regional cuisine become the hero. The interface avoids artificial depth, opting for flat, crisp containers and clear structural hierarchy to convey a sense of curated reliability and culinary excellence.

## Colors
The color palette is grounded in an organic, premium spectrum. 

- **Primary (Hunter Green):** Used for high-intent actions, active navigation states, and core branding. It signals growth, freshness, and stability.
- **Secondary (Saffron):** Reserved for high-visibility highlights such as "Best Seller" badges, star ratings, and "ADD" calls-to-action.
- **Background & Surfaces:** A warm off-white provides a soft, paper-like canvas, while pure white is used strictly for elevated cards and content containers.
- **Dietary Markers:** Standardized FSSAI-compliant colors are used for Veg (#0F8A4D) and Non-Veg (#A52A2A) indicators to ensure immediate recognition and safety.

## Typography
Typography is split between a characterful geometric sans for impact and a neutral system sans for utility.

- **Headlines & Prices:** Plus Jakarta Sans is used for all branding, titles, and numeric values. For currency, utilize **Tabular Figures** (`tnum`) to ensure price alignment in lists. The ₹ symbol should always precede the amount without a space.
- **Body & Labels:** Inter (system sans) provides high legibility for descriptions, ingredients, and micro-copy. 
- **Hierarchy:** Use bold weights for headers to create a clear "scan-path" for users browsing menus rapidly.

## Layout & Spacing
The layout operates on a **4px baseline grid** to ensure mathematical harmony between text and UI elements.

- **Margins:** A consistent 20px lateral margin is applied across all mobile screens to provide breathable padding from the device edge.
- **Grid:** On mobile, use a single-column stack for restaurant listings and a two-column masonry or fixed grid for category "bubbles" or curated collections.
- **Bottom Sheets:** Use a significant 28px top-radius for all pull-up sheets (customization, filters, cart) to create a soft, inviting transition over the background.

## Elevation & Depth
This design system eschews traditional drop shadows in favor of **Structural Layering** and **High-Contrast Outlines**.

- **Cards:** All content cards are pure white with a 1px solid border in `#EDE9E3`. This creates a sophisticated, "flat-lay" editorial look that feels premium and clean.
- **Layering:** Depth is communicated through the contrast between the warm `#FAF8F5` background and the crisp `#FFFFFF` foreground elements. 
- **Sticky Elements:** The Bottom Navigation and Top App Bar should use a subtle backdrop blur (glassmorphism) or a solid white fill with a 1px top/bottom border to separate them from the scrolling content.

## Shapes
The shape language is a mix of structured containers and organic, friendly touchpoints.

- **Buttons:** All primary and secondary buttons are **Pill-shaped**, providing a friendly and modern feel that contrasts with the structured cards.
- **Containers:** Content cards use a 16px radius, striking a balance between modern and professional.
- **Interactive Elements:** Input fields and chips follow the 8px (Soft) or Pill-shaped convention depending on their hierarchy.

## Components

- **Buttons:** 
  - **Primary:** Hunter Green background, white text, pill-shaped.
  - **Add Button:** Saffron background or border, bold Plus Jakarta Sans text. Often includes a '+' icon.
- **Cards:** 16px corner radius, white background, 1px `#EDE9E3` border. Padding should be 16px or 20px internally.
- **Bottom Navigation:** 5 equidistant tabs (Home, Search, Orders, Cart, Profile). Use active state tinting in Hunter Green. Cart icon should include a Saffron badge for item count.
- **Chips:** Used for filters (Cuisines, Rating 4.0+, Fast Delivery). Pill-shaped with a 1px border; Hunter Green fill when selected.
- **FSSAI Markers:** Small 12px squares with a circle inside. Veg (Green), Non-Veg (Brown/Red). Place at the top-left of food item images or titles.
- **Inputs:** Clean, 1px bordered fields with Inter Medium for placeholder text. Use a 12px radius for search bars.