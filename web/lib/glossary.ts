/** One-sentence definitions for dotted-underline terms (spec 3.5, 12). */
export const GLOSSARY = {
  'the line': 'The number of job postings on 1 February 2020, before the pandemic and the hiring freeze that followed, set to 100.',
  'postings index': "Indeed's count of job postings, seasonally adjusted and averaged over seven days, where 100 means the same number as on 1 February 2020.",
  'Thaw Index': "A score from 0 to 100 that combines how far a role's postings are from the line and which way they are moving.",
  breadth: 'The share of tracked companies that have at least one open posting for a role.',
  'entry access': 'The share of open postings for a role that accept people at intern or junior level.',
  verdict: 'Our reading of what happened after a company tied job cuts to AI, based only on sourced evidence, and open to change.',
  tier: 'How directly a piece of evidence comes from its source, from A for the company itself to D for an unverified report.',
  percentile: 'Where a reading sits within its own history: 90 means higher than 90% of past readings.',
  'likely range': 'The middle half of simulated paths: postings land inside it in half of the simulations built from past forecast errors.',
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
