---
name: Clinical Calm 2.0
colors:
  surface: '#f8f9f9'
  surface-dim: '#d9dada'
  surface-bright: '#f8f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f4'
  surface-container: '#edeeee'
  surface-container-high: '#e7e8e8'
  surface-container-highest: '#e1e3e3'
  on-surface: '#191c1c'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2e3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#085ac0'
  on-secondary: '#ffffff'
  secondary-container: '#5b94fd'
  on-secondary-container: '#002c66'
  tertiary: '#a43a3a'
  on-tertiary: '#ffffff'
  tertiary-container: '#fc7c79'
  on-tertiary-container: '#711419'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842325'
  background: '#f8f9f9'
  on-background: '#191c1c'
  surface-variant: '#e1e3e3'
  emerald-ring: rgba(16, 185, 129, 0.4)
  glass-surface: rgba(255, 255, 255, 0.7)
  text-primary: '#141b2b'
  text-secondary: '#3c4a42'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
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
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
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
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

This design system is engineered for a premium, patient-facing health experience that balances medical authority with emotional reassurance. The aesthetic is defined by **Clinical Minimalism** with a **Glassmorphic** layer—evoking the high-end, data-driven feel of elite wearable apps like Oura or Whoop.

The brand personality is "Ambiently Intelligent": it remains quiet and unobtrusive until needed, using soft textures and blurred depth to reduce the anxiety typically associated with clinical environments. The target audience expects precision and clarity but desires a "spa-like" digital atmosphere that feels restorative rather than diagnostic. The UI should evoke a sense of calm, control, and premium care.

## Colors

The palette is anchored by **Teal/Emerald (#10b981)**, chosen for its association with health, vitality, and "safe" medical states. 

- **Primary:** Emerald is used for vital success states, active health rings, and primary calls to action.
- **Background:** A soft off-white (#fcfdfd) serves as the canvas, providing a warmer, more approachable feel than pure sterile white.
- **Surface Strategy:** Layers utilize semi-transparent white with backdrop blurs to maintain an "ambient" quality.
- **Contrast:** While the palette is calm, text contrast adheres to strict AAA standards for primary medical data to ensure accessibility for all patient demographics.

## Typography

The design system utilizes **Inter** exclusively for its high-legibility, neutral grotesque letterforms. This ensures that clinical data is readable even on small mobile screens.

- **Legibility:** Use `body-lg` for all patient instructions to ensure maximum comfort.
- **Emphasis:** `label-caps` should be used for metadata and category headers (e.g., "BLOOD GLUCOSE") to provide a "clinical chart" structural feel.
- **Numeric Data:** For heart rate, steps, or lab values, enable `tabular-nums` via OpenType features to keep vertical columns of numbers perfectly aligned in charts and lists.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** with generous "breathable" margins to prevent the UI from feeling claustrophobic.

- **Grid:** A 12-column system for desktop and a 4-column system for mobile.
- **Rhythm:** An 8px incremental scale is used for most components, while a 4px scale is reserved for fine-tuning typography and icons.
- **Reflow:** On mobile, high-density charts should reflow into vertical summary cards to maintain readability without requiring horizontal scrolling.
- **Contextual Padding:** Cards and modals use `lg` (24px) internal padding to ensure data visualizations do not feel cramped.

## Elevation & Depth

This design system uses **Glassmorphism** and **Ambient Shadows** to create a sense of light and space.

- **Backdrop Blur:** All floating elements (Docks, Context Cards) must use a `20px` to `40px` backdrop blur. This allows the background colors to "glow" through the UI without sacrificing legibility.
- **Shadows:** Use extremely diffused, tinted shadows. Instead of pure black, use a shadow color derived from the Primary Emerald at 5-10% opacity for active elements to give them a "hovering" appearance.
- **Tonal Layering:** The primary canvas is #fcfdfd. Secondary information sits on pure white containers with 1px soft-gray borders to create subtle separation without heavy shadow use.

## Shapes

The shape language is "Soft-Tech"—using high corner radii to eliminate the "sharpness" of traditional medical software.

- **Primary Radius:** A 20px (`rounded-xl` / `rounded-2xl` equivalent) is the standard for cards and main containers.
- **Interactive Elements:** Buttons and input fields should follow a 12px to 16px radius.
- **Pill Philosophy:** Progress bars and chat bubbles should use fully rounded caps to feel friendly and organic.

## Components

- **Glassmorphic Dock:** A bottom-fixed navigation bar with a high backdrop blur. Active states are indicated by an **Emerald Ring** surrounding the icon.
- **Rich-Media Chat Bubbles:** Patient-to-clinician bubbles use a pill-shaped geometry. Clinician bubbles are #ffffff with a subtle shadow; Patient bubbles use a very light Emerald tint (5% opacity) to signify the user's voice.
- **Sliding Context Cards:** These drawer-style components slide from the bottom of the screen. They must feature a blurred backdrop and a 20px top-corner radius.
- **Buttons:** Primary buttons use a solid Emerald fill. Secondary buttons should be glassmorphic—a white semi-transparent fill with an Emerald-colored 1px border.
- **Input Fields:** Soft-white fills with 1px borders that glow Emerald upon focus. The focus state should include a soft, diffused "aura" rather than a hard stroke.
- **Health Chips:** Small, fully rounded indicators for status (e.g., "Normal," "Elevated"). They should use low-saturation versions of semantic colors to remain "calm" while being informative.