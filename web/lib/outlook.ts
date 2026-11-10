import 'server-only';
import { isPaused } from './freshness';
import { changeOver, notPredictableSentence, outlookStatement, postingsNoun, recoverySentence, sectorSentence } from './statements';
import { metrics, shortSectorLabel } from './metrics';
import {
  fourWeekMeans,
  getCountries,
  getDataset,
  getFamilies,
  getForecast,
  getSeriesMeta,
  getThawIndex,
  getWeekly,
  indeedSeriesId,
  type Country,
  type Dataset,
  type Family,
  type ForecastRow,
  type ThawRow,
  type WeeklyPoint,
} from './queries';
import { countryInSentence } from './site';

export type Outlook = {
  family: Family;
  country: Country;
  where: string;
  dataset: Dataset | null;
  paused: boolean;
  hasSector: boolean;
  seriesId: string;
  weekly: WeeklyPoint[];
  fourWeek: WeeklyPoint[];
  thaw: ThawRow | null;
  forecast: ForecastRow | null;
  statement: string;
  trendStatement: string;
  change13: number | null;
};

export async function resolveRole(familyId: string | undefined, countryCode: string | undefined) {
  const [families, countries] = await Promise.all([getFamilies(), getCountries()]);
  const family = families.find((f) => f.id === familyId) ?? null;
  const country = countries.find((c) => c.code === (countryCode ?? 'US')) ?? countries.find((c) => c.code === 'US') ?? countries[0] ?? null;
  return { families, countries, family, country };
}

export async function buildOutlook(family: Family, country: Country): Promise<Outlook> {
  const where = countryInSentence(country.code, country.label);
  const dataset = await getDataset('indeed_jpi');
  const paused = dataset ? isPaused(dataset.freshness) : true;
  // Indeed publishes a different set of sectors in each country (France has no
  // Data & Analytics sector, for example), so check this role's sector exists here.
  const hasSector = country.hasSectors && (await getSeriesMeta(indeedSeriesId(country.code, family.indeedSector))) !== null;
  const seriesId = indeedSeriesId(country.code, hasSector ? family.indeedSector : null);
  const [weekly, thaw, forecast] = await Promise.all([
    getWeekly(seriesId),
    hasSector ? getThawIndex(family.id, country.code) : Promise.resolve(null),
    getForecast(seriesId),
  ]);
  const fourWeek = fourWeekMeans(weekly);
  const values = fourWeek.map((p) => p.value);
  const latest = weekly[weekly.length - 1]?.value;
  const noun = postingsNoun(hasSector ? shortSectorLabel(family.indeedSector) : null);
  const change13 = changeOver(values, metrics.statements.direction_weeks);

  let statement: string;
  if (!hasSector) {
    const why = country.hasSectors
      ? `Indeed does not publish its ${family.indeedSector} sector for ${country.label}`
      : `Indeed does not publish sector data for ${country.label}`;
    statement = `${family.label} in ${where}: ${why}, so there is no role-level score. ${sectorSentence(postingsNoun(null, where), values, latest)}`;
  } else if (paused || !thaw) {
    statement = `${family.label} in ${where}: the score is paused until the source updates. ${values.length ? sectorSentence(noun, values, latest) : ''}`.trim();
  } else {
    statement = outlookStatement(family.label, where, thaw.state, thaw.score, noun, values, latest);
  }

  let trendStatement: string;
  if (paused) trendStatement = 'Projections are paused until the source updates.';
  else if (forecast?.shipped && forecast.recovery) trendStatement = recoverySentence(forecast.recovery);
  else trendStatement = notPredictableSentence(change13);

  return { family, country, where, dataset, paused, hasSector, seriesId, weekly, fourWeek, thaw, forecast, statement, trendStatement, change13 };
}
