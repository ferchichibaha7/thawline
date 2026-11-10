import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/site';

const meta = {
  type: 'object',
  properties: {
    source: { type: 'string' },
    license: { type: 'string' },
    data_through: { type: 'string', format: 'date', nullable: true },
    generated_at: { type: 'string', format: 'date-time' },
    method_version: { type: 'object', additionalProperties: { type: 'string' } },
  },
};
const fmt = { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'] } };
const country = { name: 'country', in: 'query', schema: { type: 'string', example: 'US' } };
const ok = (description: string) => ({
  200: { description, content: { 'application/json': { schema: { type: 'object', properties: { meta, data: {} } } }, 'text/csv': {} } },
});

/** OpenAPI description of the public API (spec 9.3). */
export function GET() {
  return NextResponse.json(
    {
      openapi: '3.1.0',
      info: {
        title: 'Thawline API',
        version: '1',
        description: 'Read-only, free, no key. Data produced by Thawline is CC BY 4.0; source data keeps its own license, given in meta.',
        license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
      },
      servers: [{ url: `${SITE_URL}/api/v1` }],
      paths: {
        '/sectors': { get: { summary: 'Current index, 13-week change and position for each sector', parameters: [country, fmt], responses: ok('Sectors') } },
        '/series/{id}': {
          get: {
            summary: 'Observations and the latest published forecast',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'indeed.US.software-development' } }, fmt],
            responses: ok('Series'),
          },
        },
        '/outlook/{family}': {
          get: {
            summary: 'Thaw Index, components, state and statement',
            parameters: [{ name: 'family', in: 'path', required: true, schema: { type: 'string', example: 'frontend' } }, country, fmt],
            responses: ok('Outlook'),
          },
        },
        '/signals': {
          get: {
            summary: 'Signals, newest first',
            parameters: [{ name: 'since', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'kind', in: 'query', schema: { type: 'string' } }, country, fmt],
            responses: ok('Signals'),
          },
        },
        '/datasets': { get: { summary: 'Freshness and licenses', parameters: [fmt], responses: ok('Datasets') } },
      },
    },
    { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=86400' } },
  );
}
