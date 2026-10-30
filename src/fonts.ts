/**
 * Self-hosted web fonts (Fontsource WOFF2, font-display: swap). These are open-source stand-ins
 * until the licensed ADNOC fonts are supplied; the families are named in the theme tokens
 * (src/shared/theme/tokens.css), so swapping in ADNOC Sans, Martina Plantijn or Greta Arabic is a
 * token change plus new imports here.
 *
 * - Barlow: temporary stand-in for ADNOC Sans (brand headings, KPI figures).
 * - Source Serif 4: temporary stand-in for Martina Plantijn (introductory and KPI copy).
 * - IBM Plex Sans Arabic: temporary stand-in for Greta Arabic (Arabic text).
 */
import '@fontsource/barlow/300.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow/800.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
