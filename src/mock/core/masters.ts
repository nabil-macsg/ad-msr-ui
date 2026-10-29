import { audit, trail } from './audit';
import { bodyOf, json, MockError, type MockRequest, noContent, notFound, text } from './http';
import { listRows, type ListSpec } from './list';
import { route } from './router';
import { all, find, insert, newId, now, removeRow, replace } from './store';

export interface MasterRow {
  id: string;
  version: number;
  isActive: boolean;
  deactivatedReason?: string | null;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface MasterSpec<T extends MasterRow> extends ListSpec<T> {
  /** Audit record type, e.g. `fleet-unit`. */
  readonly recordType?: string;
  /** The record's short reference and label in the audit trail. */
  readonly describe?: (row: T) => { ref: string; label: string };
  /** Builds a new record from a create body; throws MockError for invalid input. */
  readonly create?: (
    body: Record<string, unknown>,
  ) => Omit<T, 'id' | 'version' | 'isActive' | 'updatedAt'>;
  /** Applies an edit body to the current record. */
  readonly update?: (current: T, body: Record<string, unknown>) => T;
  /** `GET …/options`: the form's choices. */
  readonly options?: () => unknown;
  /** Field that must stay unique (default `code` when present). */
  readonly unique?: string;
  /** What the API returns for a stored row (e.g. with fields derived from other records). */
  readonly view?: (row: T) => unknown;
}

const describeDefault = (row: MasterRow) => {
  const ref = text(row.code) || text(row.registration) || row.id;
  return { ref, label: text(row.name) || ref };
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the collection's row type
function versioned<T extends MasterRow>(req: MockRequest, rows: string, noun: string): T {
  const current = find<T>(rows, req.params.id ?? '');
  if (!current) throw new MockError(404, 'NOT_FOUND', `The ${noun} was not found.`);
  const ifMatch = req.headers.get('If-Match');
  if (ifMatch !== null && Number(ifMatch) !== current.version) {
    throw new MockError(
      409,
      'VERSION_CONFLICT',
      'Someone else changed this record. Reload and try again.',
    );
  }
  return current;
}

function checkUnique(rows: string, field: string, value: unknown, id?: string) {
  if (value === undefined || value === null || value === '') return;
  const clash = all<MasterRow>(rows).some(
    (r) => r.id !== id && text(r[field]).toLowerCase() === text(value).toLowerCase(),
  );
  if (clash) {
    throw new MockError(409, `${field.toUpperCase()}_TAKEN`, `That ${field} is already used.`, {
      fields: { [field]: 'Already used' },
    });
  }
}

/**
 * The shared master endpoints (ADR-0057) for one collection under `base`:
 * list, export, one, create, edit (If-Match), deactivate, reactivate, delete, history, options.
 */
export function masterCrud<T extends MasterRow>(
  base: string,
  rows: string,
  noun: string,
  spec: MasterSpec<T> = {},
) {
  const recordType = spec.recordType ?? noun.replace(/\s+/g, '-');
  const describe = spec.describe ?? describeDefault;
  const unique = spec.unique ?? 'code';
  const view = spec.view ?? ((row: T) => row);
  const viewed = () => all<T>(rows).map((r) => view(r) as T);

  route('GET', base, (req) => {
    const page = listRows(viewed(), req.query, spec);
    return json(page);
  });
  route('GET', `${base}/export`, (req) => {
    const { items } = listRows(viewed(), withoutPaging(req.query), spec);
    return new Response(toCsv(items), {
      headers: {
        'content-type': 'text/csv',
        'content-disposition': `attachment; filename="${noun.replace(/\s+/g, '-')}-demo.csv"`,
      },
    });
  });
  route('GET', `${base}/options`, () => json(spec.options?.() ?? {}));
  route('GET', `${base}/:id`, (req) => {
    const row = find<T>(rows, req.params.id ?? '');
    return row ? json(view(row)) : notFound(noun);
  });
  route('GET', `${base}/:id/history`, (req) => json(trail(req.params.id ?? '')));

  route('POST', base, (req) => {
    const body = bodyOf(req);
    const made = spec.create ? spec.create(body) : body;
    checkUnique(rows, unique, made[unique]);
    const row = insert<T>(rows, {
      ...(made as object),
      id: newId(),
      isActive: true,
      deactivatedReason: null,
      version: 1,
      updatedAt: now(),
    } as unknown as T);
    audit(recordType, { id: row.id, ...describe(row) }, 'created', `${capital(noun)} added`, {
      after: row,
    });
    return json(view(row), 201);
  });

  route('PATCH', `${base}/:id`, (req) => {
    const current = versioned<T>(req, rows, noun);
    const body = bodyOf(req);
    const changed = spec.update ? spec.update(current, body) : { ...current, ...body };
    checkUnique(rows, unique, changed[unique], current.id);
    const row = replace<T>(rows, { ...changed, version: current.version + 1, updatedAt: now() });
    audit(recordType, { id: row.id, ...describe(row) }, 'changed', `${capital(noun)} changed`, {
      before: current,
      after: row,
      reason: typeof body.reason === 'string' ? body.reason : null,
    });
    return json(view(row));
  });

  for (const [action, active] of [
    ['deactivate', false],
    ['reactivate', true],
  ] as const) {
    route('POST', `${base}/:id/${action}`, (req) => {
      const current = versioned<T>(req, rows, noun);
      const reason = text(bodyOf(req).reason);
      if (current.isActive === active) {
        throw new MockError(
          409,
          'ALREADY_IN_STATE',
          `The ${noun} is already ${active ? 'active' : 'deactivated'}.`,
        );
      }
      const row = replace<T>(rows, {
        ...current,
        isActive: active,
        deactivatedReason: active ? null : reason,
        version: current.version + 1,
        updatedAt: now(),
      });
      const verb = active ? 'reactivated' : 'deactivated';
      audit(recordType, { id: row.id, ...describe(row) }, verb, `${capital(noun)} ${verb}`, {
        reason,
      });
      return json(view(row));
    });
  }

  route('DELETE', `${base}/:id`, (req) => {
    const current = versioned<T>(req, rows, noun);
    removeRow(rows, current.id);
    audit(
      recordType,
      { id: current.id, ...describe(current) },
      'deleted',
      `${capital(noun)} deleted`,
      {
        reason: text(bodyOf(req).reason),
      },
    );
    return noContent();
  });
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function withoutPaging(query: URLSearchParams): URLSearchParams {
  const copy = new URLSearchParams(query);
  copy.delete('page');
  copy.delete('pageSize');
  return copy;
}

function toCsv(rows: readonly object[]): string {
  const flat = rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).filter(
        ([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v),
      ),
    ),
  );
  const headers = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => `"${text(v).replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...flat.map((r) => headers.map((h) => cell((r as Record<string, unknown>)[h])).join(',')),
  ].join('\n');
}
