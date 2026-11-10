import { describe, expect, it } from 'vitest';
import {
  aftermathStatement,
  currentStreak,
  directionClause,
  entryAccessSentence,
  notPredictableSentence,
  outlookStatement,
  positionClause,
  postingsNoun,
  pressureStatement,
  recoverySentence,
  sectorSentence,
} from './statements';
import { formatDate, formatQuarter, lineWords } from './format';

const rising = (k: number, start = 60) => [
  70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60, 59, 58, 57,
  ...Array.from({ length: k }, (_, i) => start + i + 1),
];

describe('position clause', () => {
  it('reads at the line within 2 points', () => {
    expect(positionClause('Software job postings', 101.9)).toBe('Software job postings are at the line');
    expect(positionClause('Software job postings', 98)).toBe('Software job postings are at the line');
  });
  it('reads below and above', () => {
    expect(positionClause('Software job postings', 66)).toBe('Software job postings are 34% below the line');
    expect(positionClause('Software job postings', 112.4)).toBe('Software job postings are 12% above the line');
  });
  it('builds nouns', () => {
    expect(postingsNoun('Software')).toBe('Software job postings');
    expect(postingsNoun('Software', 'the United States')).toBe('Software job postings in the United States');
    expect(postingsNoun(null, 'France')).toBe('Job postings in France');
  });
});

describe('direction clause', () => {
  it('counts streaks', () => {
    expect(currentStreak([1, 2, 3, 4, 5])).toBe(4);
    expect(currentStreak([5, 4, 3, 2])).toBe(-3);
    expect(currentStreak([1, 2, 2])).toBe(0);
  });
  it('reports a rising streak of four or more', () => {
    expect(directionClause(rising(9))).toBe('and have risen for 9 weeks');
  });
  it('reports a falling streak', () => {
    expect(directionClause([90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77])).toBe(
      'and have fallen for 13 weeks',
    );
  });
  it('falls back to the 13-week change', () => {
    const up = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 110, 104, 105];
    expect(directionClause(up)).toBe('and are up 5% in three months');
    const down = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 90, 96, 95];
    expect(directionClause(down)).toBe('and are down 5% in three months');
    const flat = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 99, 101, 101];
    expect(directionClause(flat)).toBe('and have been flat for three months');
  });
  it('omits direction without 13 weeks of history', () => {
    expect(directionClause([1, 2, 1])).toBe('');
    expect(sectorSentence('Job postings', [1, 2, 1])).toBe('Job postings are 99% below the line.');
  });
  it('takes position from the latest week when given', () => {
    expect(sectorSentence('Job postings', rising(9, 57), 81.3)).toBe(
      'Job postings are 19% below the line and have risen for 9 weeks.',
    );
  });
});

describe('page statements', () => {
  it('builds the outlook statement', () => {
    expect(
      outlookStatement('Frontend engineering', 'France', 'Cold', 31.4, 'Software job postings', rising(9, 57)),
    ).toBe(
      'Frontend engineering in France: Cold, 31 of 100. Software job postings are 34% below the line and have risen for 9 weeks.',
    );
  });
  it('builds aftermath and pressure statements', () => {
    expect(aftermathStatement(31, 9, 6)).toBe(
      'Of 31 companies that tied job cuts to AI, 9 have walked them back and 6 are holding.',
    );
    expect(pressureStatement('Stretched', 6, 9)).toBe(
      'The AI boom is stretched, not yet strained. 6 of 9 indicators sit above their long-run norm.',
    );
    expect(pressureStatement('Calm', 1, 9)).toBe('The AI boom is calm. 1 of 9 indicators sit above their long-run norm.');
    expect(pressureStatement('Strained', 8, 9)).toMatch(/^The AI boom is strained\./);
  });
  it('builds the entry access sentence', () => {
    expect(entryAccessSentence(0.06)).toBe(
      'Few openings accept under two years of experience right now: 6% of postings.',
    );
  });
});

describe('recovery wording', () => {
  it('covers every branch', () => {
    expect(recoverySentence({ status: 'above', q20: null, q80: null })).toBe('Postings are above the line.');
    expect(recoverySentence({ status: 'range', q20: '2027-05-07', q80: '2028-11-03' })).toBe(
      'At the current pace, postings reach the line between mid-2027 and late 2028.',
    );
    expect(recoverySentence({ status: 'range', q20: '2027-04-02', q80: '2027-08-06' })).toBe(
      'At the current pace, postings reach the line in mid-2027.',
    );
    expect(recoverySentence({ status: 'earliest', q20: '2027-02-05', q80: null })).toBe(
      'At the current pace, the earliest likely return to the line is early 2027. It may take longer than two years.',
    );
    expect(recoverySentence({ status: 'none', q20: null, q80: null })).toBe(
      'At the current pace, postings do not reach the line within two years.',
    );
  });
  it('words the fallback', () => {
    expect(notPredictableSentence(4.2)).toBe(
      'The trend is not predictable enough to project. Recent direction: up 4% in 13 weeks.',
    );
    expect(notPredictableSentence(-7.6)).toBe(
      'The trend is not predictable enough to project. Recent direction: down 8% in 13 weeks.',
    );
    expect(notPredictableSentence(0.3)).toBe(
      'The trend is not predictable enough to project. Recent direction: flat over 13 weeks.',
    );
    expect(notPredictableSentence(null)).toBe('The trend is not predictable enough to project.');
  });
});

describe('format', () => {
  it('formats dates and quarters', () => {
    expect(formatDate('2026-11-06')).toBe('6 Nov 2026');
    expect(formatQuarter('2027-01-15')).toBe('early 2027');
    expect(formatQuarter('2027-06-15')).toBe('mid-2027');
    expect(formatQuarter('2027-09-30')).toBe('mid-2027');
    expect(formatQuarter('2027-10-01')).toBe('late 2027');
    expect(lineWords(66)).toBe('34% below');
    expect(lineWords(101)).toBe('at the line');
  });
});
