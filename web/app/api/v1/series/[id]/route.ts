import { failed, methodVersions, notFound, respond } from '@/lib/api';
import { attempt, getDataset, getForecast, getObservations, getSeriesMeta } from '@/lib/queries';

export const revalidate = 3600;

/** Observations and the latest published forecast (spec 9.3). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await attempt(async () => {
    const meta = await getSeriesMeta(id);
    if (!meta) return null;
    const [observations, forecast, dataset] = await Promise.all([getObservations(id), getForecast(id), getDataset(meta.datasetId)]);
    return { meta, observations, forecast, dataset };
  });
  if (!r.ok) return failed();
  if (!r.data) return notFound(`No series ${id}`);
  const { meta, observations, forecast, dataset } = r.data;
  const published = forecast?.shipped
    ? { made_on: forecast.madeOn, model: forecast.model, mase_26: forecast.mase26, recovery: forecast.recovery, paths: forecast.paths }
    : null;
  return respond(
    request,
    {
      source: dataset?.attribution ?? meta.datasetId,
      license: dataset?.license ?? 'See /data',
      data_through: observations[observations.length - 1]?.date ?? null,
      method_version: methodVersions,
    },
    { series: meta, observations, forecast: published },
    observations.map((o) => ({ series_id: id, date: o.date, value: o.value })),
    id,
  );
}
