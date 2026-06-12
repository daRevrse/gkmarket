---
name: Lumina West
colors:
  surface: '#041522'
  surface-dim: '#041522'
  surface-bright: '#2b3b49'
  surface-container-lowest: '#00101c'
  surface-container-low: '#0c1d2a'
  surface-container: '#10212f'
  surface-container-high: '#1b2c39'
  surface-container-highest: '#263645'
  on-surface: '#d3e4f7'
  on-surface-variant: '#d7c3ae'
  inverse-surface: '#d3e4f7'
  inverse-on-surface: '#223240'
  outline: '#9f8e7a'
  outline-variant: '#524534'
  surface-tint: '#ffb955'
  primary: '#ffc880'
  on-primary: '#452b00'
  primary-container: '#f5a623'
  on-primary-container: '#644000'
  inverse-primary: '#835500'
  secondary: '#43e5b1'
  on-secondary: '#003828'
  secondary-container: '#01c896'
  on-secondary-container: '#004d38'
  tertiary: '#c5d3e7'
  on-tertiary: '#243141'
  tertiary-container: '#a9b7cb'
  on-tertiary-container: '#3b4859'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb4'
  primary-fixed-dim: '#ffb955'
  on-primary-fixed: '#291800'
  on-primary-fixed-variant: '#633f00'
  secondary-fixed: '#60fcc6'
  secondary-fixed-dim: '#3adfab'
  on-secondary-fixed: '#002116'
  on-secondary-fixed-variant: '#00513b'
  tertiary-fixed: '#d6e4f9'
  tertiary-fixed-dim: '#bac8dc'
  on-tertiary-fixed: '#0f1c2c'
  on-tertiary-fixed-variant: '#3a4859'
  background: '#041522'
  on-background: '#d3e4f7'
  surface-variant: '#263645'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The brand identity centers on the "Tech Unicorn" aesthetic—evoking a sense of significant capital, high reliability, and rapid pan-African expansion. The UI must feel expensive, stable, and forward-looking. 

The design style is a **Premium Dark Glassmorphism**. It utilizes deep midnight navy foundations to provide a stable, high-contrast backdrop for vibrant emerald and gold accents. The interface relies on translucent layers, precise light-source modeling (gold glows), and high-fidelity typography to distinguish Deal Lomé as a leader in both B2B logistics and B2C retail.

## Colors

The palette is anchored by **Midnight Navy (#0D1B2A)**, providing a sophisticated depth that outperforms pure black. 

- **Gold (#F5A623):** Used for primary calls to action, premium indicators, and subtle radial "glow" accents that suggest prosperity and value.
- **Emerald (#00C896):** Signifies growth, successful transactions, and trust. Used for success states and secondary utility actions.
- **Text Hierarchy:** Primary information uses **White (#FFFFFF)** for maximum legibility against the dark ground. Secondary information and metadata use **Blue-Gray (#8899AA)** to reduce visual noise.

## Typography

Typography balances aggressive, heavy-weight headers with technical, high-precision body text.

- **Headlines:** Utilizes **Plus Jakarta Sans** at Extra Bold (800) and Heavy (900) weights. This creates a bold "market leader" presence.
- **Body:** **Hanken Grotesk** provides a clean, geometric feel that ensures legibility in dense B2B inventory lists.
- **Data/Technical:** **Geist** is used for labels, price points, and status tags to provide a modern, developer-grade precision to the marketplace's transactional data.

## Layout & Spacing

The design system employs a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

- **Spacing Rhythm:** Based on an 8px base unit.
- **Padding:** High-internal padding (32px+) is preferred for cards to maintain the premium "airy" feel.
- **Margins:** Desktop views should maintain generous 40px side margins to isolate the content as a premium "dashboard" experience. 
- **Reflow:** On mobile, complex B2B tables should reflow into expandable card stacks to maintain glassmorphism legibility.

## Elevation & Depth

Depth is established through three specific layers:

1.  **Base Layer:** The midnight navy background (#0D1B2A).
2.  **Glass Layer:** Cards and modals using `rgba(255, 255, 255, 0.05)` with a **12px backdrop-blur**. Each glass element must have a `1px` solid border of `rgba(255, 255, 255, 0.08)` to define its edges against the dark background.
3.  **Accent Layer:** Subtle **Gold (#F5A623)** radial gradients (opacity 5-10%) placed behind primary cards or buttons to simulate a soft "under-glow," giving the impression that the UI is powered by a golden light source. 

Shadows are deep and extremely diffused: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)`.

## Shapes

The shape language is modern and approachable, utilizing large radii to soften the high-contrast color scheme.

- **Cards/Containers:** Use **24px** (`rounded-xl`) for main dashboard containers and **16px** (`rounded-lg`) for inner content sections.
- **Interactive Elements:** Buttons and Input fields use a consistent **12px** radius, providing a distinct "clicky" and ergonomic feel.
- **Status Pills:** Fully rounded (pill-shaped) to differentiate them from functional buttons.

## Components

- **Buttons:** Primary buttons are Solid Gold (#F5A623) with Bold Black text for maximum impact. Secondary buttons are Ghost style with the Emerald (#00C896) border and text.
- **Cards:** Must implement the glassmorphism spec (blur + low-opacity border). For B2B "Featured" items, add the subtle gold glow effect on hover.
- **Input Fields:** Semi-transparent backgrounds with a 1px border. On focus, the border transitions to Emerald (#00C896) with a faint emerald outer glow.
- **Chips/Badges:** Use Geist font at 12px. B2B "Wholesale" badges should use a Gold outline; B2C "Verified" badges use an Emerald fill.
- **Lists:** Items separated by 1px lines of `rgba(255, 255, 255, 0.04)`. High contrast between the Item Name (White) and Metadata (Blue-Gray).
- **Progress Indicators:** Use Emerald for completion. The track should be a darker navy (#08121C) to maintain depth.