import { describe, expect, it } from 'vitest';
import { parseListParams, toApiQuery, toExportQuery } from './list-params';

describe('PROMPT-2.16 list parameters', () => {
  it('PROMPT-2.16 reads q, page, pageSize, sort, filters and includeDeactivated', () => {
    const params = parseListParams(
      new URLSearchParams(
        'q=das&page=3&pageSize=50&sort=createdAt:desc&filter[status]=pending&filter[zone]=z1&includeDeactivated=true',
      ),
    );
    expect(params).toEqual({
      q: 'das',
      page: 3,
      pageSize: 50,
      sort: { field: 'createdAt', dir: 'desc' },
      filters: { status: 'pending', zone: 'z1' },
      includeDeactivated: true,
    });
    expect(toApiQuery(params)).toEqual({
      q: 'das',
      page: 3,
      pageSize: 50,
      sort: 'createdAt:desc',
      'filter[status]': 'pending',
      'filter[zone]': 'z1',
      includeDeactivated: true,
    });
  });

  it('PROMPT-2.16 falls back to safe defaults', () => {
    const params = parseListParams(
      new URLSearchParams('page=-2&pageSize=5000&sort=name:sideways'),
      {
        sort: { field: 'name', dir: 'asc' },
      },
    );
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(100);
    expect(params.sort).toEqual({ field: 'name', dir: 'asc' });
    expect(toApiQuery(parseListParams(new URLSearchParams()))).toEqual({ page: 1, pageSize: 20 });
  });

  it('PROMPT-2.16 exports the same list without paging', () => {
    const params = parseListParams(
      new URLSearchParams('q=das&page=3&pageSize=50&filter[zone]=z1&includeDeactivated=true'),
    );
    expect(toExportQuery(params)).toEqual({
      q: 'das',
      'filter[zone]': 'z1',
      includeDeactivated: true,
    });
  });
});
