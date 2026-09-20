---
name: Industrial Logistics Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#43474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777e'
  outline-variant: '#c3c6ce'
  surface-tint: '#49607c'
  primary: '#001428'
  on-primary: '#ffffff'
  primary-container: '#0f2942'
  on-primary-container: '#7991af'
  inverse-primary: '#b0c9e8'
  secondary: '#a73a00'
  on-secondary: '#ffffff'
  secondary-container: '#fd651e'
  on-secondary-container: '#571a00'
  tertiary: '#000e3b'
  on-tertiary: '#ffffff'
  tertiary-container: '#002069'
  on-tertiary-container: '#728adf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#b0c9e8'
  on-primary-fixed: '#011d35'
  on-primary-fixed-variant: '#314863'
  secondary-fixed: '#ffdbce'
  secondary-fixed-dim: '#ffb599'
  on-secondary-fixed: '#370e00'
  on-secondary-fixed-variant: '#7f2b00'
  tertiary-fixed: '#dce1ff'
  tertiary-fixed-dim: '#b6c4ff'
  on-tertiary-fixed: '#00164e'
  on-tertiary-fixed-variant: '#264191'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0em
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0.005em
  title-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.015em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1rem
  margin-tablet: 1.5rem
  space-xxs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-xxl: 3rem
---

## Brand & Style

This design system drives a resilient, mission-critical B2B freight marketplace tailored for fleet operators, logistics managers, brokers, and truck drivers under diverse real-world conditions. The core persona balances rigorous operational demands—speed, spatial awareness, and transactional certainty—with outdoor readability under direct sunlight and high-stress roadside environments.

The visual approach synthesizes **Corporate / Modern (Material Design 3)** with an **Industrial Utility** aesthetic:
- **Structural Integrity:** Heavy, deliberate layouts that communicate reliability, load stability, and logistical scale.
- **Urgent Actionability:** High-contrast focal triggers that prevent operational friction during high-frequency tasks such as dispatch confirmations, route accepting, and bid submissions.
- **Clarity Over Embellishment:** Minimal decorative distraction; functional typography and distinct data hierarchies optimize scanning velocity and eliminate cognitive load.

## Colors

The color palette is engineered around heavy industrial trustworthiness paired with high-visibility safety triggers. 

### Palette Architecture
- **Primary (`#0F2942`) & Primary Container (`#1E3A8A`):** Anchors primary scaffolding, top app bars, heavy container frames, navigation rails, and core branding. Evokes structural steel, maritime shipping containers, and mechanical durability.
- **Secondary Action Accent (`#EA580C` & `#F97316`):** Safety Highway Orange. Exclusively reserved for forward-moving, conversion-critical actions: "+ Post a Load", "Accept Trip", "Confirm Delivery", and floating key action buttons.
- **Tertiary Industrial Ink (`#1E3A8A`):** Used for analytical visual tags, route lines, secondary markers, and structural data emphasis.
- **Neutral Foundation:**
  - Base Background: `#F8FAFC` (Slate 50)
  - Surface Neutral: `#FFFFFF` (Pure white for cards and high-emphasis sheets)
  - Surface Variant / Canvas Subdued: `#F1F5F9` (Slate 100)
  - Structural Hairlines & Borders: `#E2E8F0` (Slate 200)
  - Text Primary: `#0F172A` (Slate 900)
  - Text Secondary: `#475569` (Slate 600)
  - Text Subdued / Placeholders: `#94A3B8` (Slate 400)

### Logistics Operational Statuses
- **Active / Completed / In-Transit / Online:** `#16A34A` (Emerald 600) with container `#DCFCE7` (Emerald 50).
- **Pending / In Review / Attention Required:** `#D97706` (Amber 600) with container `#FEF3C7` (Amber 50).
- **Declined / Delayed / Breakdown / Critical Alert:** `#DC2626` (Crimson 600) with container `#FEE2E2` (Crimson 50).

## Typography

Inter serves across all typography roles to ensure deterministic vertical metrics, exceptional legibility on low-resolution mobile displays, and high-clarity tabular figures.

### Numerics and Logistics Data
- Set all numerical fields (freight tonnage, pricing per ton, axle load metrics, vehicle plates, OTPs, and speed telemetry) using tabular figures (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during real-time tracking updates.
- Metric values in KPI cards use `headline-lg-mobile` or `headline-md` paired with a trailing `label-sm` or `body-sm` unit descriptor (e.g., "24.5 MT", "₹42,000").
- Key journey points and freight status headers rely on `title-md` and `title-sm` set to weight `600` for clear visual grounding during in-cab scanning.

## Layout & Spacing

The layout is built upon an 8dp baseline grid adapted for high-density mobile interfaces with fluid distribution.

### Grid Architecture
- **Mobile Handheld (360dp – 599dp):** Single fluid column with `margin: 1rem` (16dp) and `gutter-mobile: 0.75rem` (12dp). Vertical scroll rhythm is prioritized; multi-column placement is restricted to 2-column KPI grids and action splits.
- **Tablet / In-Cab Mounted Terminals (600dp – 839dp):** 8-column layout with `margin-tablet: 1.5rem` (24dp) and `gutter: 1rem` (16dp), allowing simultaneous display of the live route map on 5 columns alongside the load order queue on 3 columns.
- **Minimum Touch Target:** All interactive controls (tabs, filter chips, call triggers, submit actions) must strictly measure at least 48dp vertically and horizontally to prevent missed inputs while operating moving machinery or wearing work gloves.

## Elevation & Depth

Depth in this design system aligns with Material Design 3 surface elevation principles, modified with crisp borders to maintain clarity in high-glare ambient environments.

### Tonal Surface Strategy
- **Level 0 (Base Canvas):** `#F8FAFC`. Un-elevated, clean slate background.
- **Level 1 (Resting Cards & Listings):** `#FFFFFF` background overlaid with a structural hairline border of `1px solid #E2E8F0`. Shadow: `0px 1px 3px rgba(15, 41, 66, 0.05)`.
- **Level 2 (KPI Metric Tiles & Interactive Cards):** `#FFFFFF` with `0px 4px 6px -1px rgba(15, 41, 66, 0.07), 0px 2px 4px -2px rgba(15, 41, 66, 0.05)`. Border remains `1px solid #E2E8F0`.
- **Level 3 (Sticky Headers, Search Bars, Modals):** `#FFFFFF` with `0px 10px 15px -3px rgba(15, 41, 66, 0.1), 0px 4px 6px -4px rgba(15, 41, 66, 0.05)`.
- **Level 4 (Floating Action Buttons & Bottom Drawers):** `#EA580C` or `#0F2942` with `0px 14px 20px -4px rgba(234, 88, 12, 0.35)`.

Elevation changes must rely on subtle tint shifts and low-spread ambient navy shadows rather than heavy generic black blurs, anchoring elements firmly into the industrial blue visual hierarchy.

## Shapes

The design system incorporates geometric hierarchy to distinguish static operational metrics from interactive surfaces:
- **`rounded-2xl` (16dp / 1rem):** Primary surface containers, including elevate-on-touch freight listing cards, comprehensive quote sheets, and bottom navigation sheets.
- **`rounded-xl` (12dp / 0.75rem):** Operational KPI containers, data stats tiles, vehicle dimension wrappers, and text input fields.
- **`rounded-lg` (8dp / 0.5rem):** Action buttons, quick-filter segment controllers, and verification modal dialogs.
- **`rounded-full` (9999px / Pill):** Status indicators, trip stage tags, vehicle body-type tags (e.g., "32 FT Multi-Axle"), and floating quick actions.

## Components

### Buttons
- **Primary Operational CTA (Highway Orange):** Background `#EA580C`, text `#FFFFFF`, height `52px`, `rounded-lg`, typography `label-lg`. Active state shifts to `#C2410C`. Shadow: `0 4px 12px rgba(234, 88, 12, 0.28)`.
- **Secondary Industrial Action (Navy):** Background `#0F2942`, text `#FFFFFF`, height `48px`, `rounded-lg`. Used for secondary workflows ("Assign Driver", "Download E-Way Bill").
- **Outline / Neutral Button:** Surface transparent, border `1.5px solid #CBD5E1`, text `#0F2942`, height `48px`.

### Freight Cards & KPI Containers
- **Freight Request Card:** Surface `#FFFFFF`, corner radius `16px` (`rounded-2xl`), border `1px solid #E2E8F0`. Internal padding `16px`. Features pickup-to-drop route nodes connected via a vertical dashed line, highlighted freight rate in bold numeric tabular font, and vehicle specification tags.
- **Metric KPI Card:** Surface `#F1F5F9`, corner radius `12px` (`rounded-xl`), border `1px solid #E2E8F0`, padding `12px`. Value set in `headline-md` with neutral label above in `label-sm`.

### Status Badges & Pill Badges
- Constructed with `rounded-full`, horizontal padding `10px`, vertical padding `4px`.
- **Active / Verified / On-Trip:** `#DCFCE7` background, `#16A34A` text, leading `6px` solid emerald dot indicator.
- **Pending Confirmation:** `#FEF3C7` background, `#D97706` text.
- **Delayed / Urgent Exception:** `#FEE2E2` background, `#DC2626` text.

### Form Inputs & Text Fields
- Container height `56px`, fill `#FFFFFF`, border `1.5px solid #CBD5E1`, corner radius `12px` (`rounded-xl`).
- Focused state transitions border to `#0F2942` at `2px` width with zero ambient glow to maintain strict visual precision.
- Supporting text, units (e.g., "Tons", "KM"), and currency prefixes ("₹") rendered in `body-md` weighted with `#475569`.

### Selection Controls
- **Checkboxes & Radios:** Unselected outline `#94A3B8`, active fill `#0F2942` with white checkmark. Minimum tap footprint expanded to `48x48dp`.
- **Switch:** Track inactive `#E2E8F0`, track active `#EA580C`. Thumb in pure white `#FFFFFF` with Level 1 elevation.

### Specialized Logistics Components
- **Route Stepper Indicator:** 10dp filled circle for origin (Emerald Green), connected by a 2dp solid slate line down to a 10dp destination icon pin (Crimson Red).
- **Load Tonnage Progress Bar:** 6dp height, background `#E2E8F0`, filled value `#0F2942` or `#EA580C` upon reaching capacity overload.