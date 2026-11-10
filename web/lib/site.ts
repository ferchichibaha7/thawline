/** The canonical origin. Never hardcoded: read from NEXT_PUBLIC_SITE_URL (spec 2.4). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const DESCRIPTION = 'Where tech and design jobs stand after the AI cuts, in sourced data.';
export const TAGLINE = 'See where the freeze is lifting.';

/** Country names that read with "the" in a sentence. */
const WITH_THE = new Set(['US', 'GB', 'NL']);
export const countryInSentence = (code: string, label: string) => (WITH_THE.has(code) ? `the ${label}` : label);
