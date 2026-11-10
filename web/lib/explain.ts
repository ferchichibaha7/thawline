/** "How to read this" texts: what it is, how to read it, where it comes from, what it cannot tell you (spec 12). */
export const EXPLAIN = {
  thawIndex: {
    what: 'The Thaw Index is a score from 0 to 100 for a role in a country. Below 25 is Frozen, 25 to 49 Cold, 50 to 74 Thawing, 75 and above Open.',
    read: 'Today it combines two parts: where postings stand against the line, and how they moved over the last 13 weeks. A role at the line with flat postings scores about 67.',
    source: "It is calculated each week from Indeed Hiring Lab's sector postings index for the sector that holds this role. The method page gives the formula.",
    limits: 'Roles that share a sector share a score until role-level job-board data arrives. It says nothing about pay, applicants per opening or any single company.',
  },
  trend: {
    what: "Indeed's count of job postings for this sector, as weekly averages, where 100 is the level on 1 February 2020.",
    read: 'The dark line is the sector. Shading shows the gap to the line: blue below it, green above. A dashed line and grey bands, when shown, project the recent pattern forward.',
    source: 'Indeed Hiring Lab publishes the index daily, seasonally adjusted and averaged over seven days, under CC BY 4.0.',
    limits: 'Postings measure demand, not hires. A projection only appears when it beat a simple baseline in testing, and it cannot foresee shocks.',
  },
  strip: {
    what: 'Each dot is an occupational sector in Indeed data. Its height shows how far postings are above or below the line.',
    read: 'Dots below the line are in blue, darker when more than 25% below. Dots above are green. The faint tail shows where the sector stood 13 weeks ago.',
    source: "Indeed Hiring Lab's sector postings index, weekly average of the daily readings.",
    limits: 'Sectors are Indeed categories built from job titles. A sector can contain roles that are doing better or worse than its average.',
  },
} as const;
