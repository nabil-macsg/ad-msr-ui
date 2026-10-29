import { describe, expect, it } from 'vitest';
import { changesOf } from './changes';

describe('PROMPT-2.8 audit change summaries', () => {
  it('lists the fields that changed, in plain words', () => {
    expect(
      changesOf(
        { code: 'DAS', pobLimit: 120, isActive: true, tags: ['a'], focal: null },
        { code: 'DAS', pobLimit: 150, isActive: false, tags: ['a', 'b'], focal: 'Reem' },
      ),
    ).toEqual([
      { field: 'Pob limit', from: '120', to: '150' },
      { field: 'Is active', from: 'Yes', to: 'No' },
      { field: 'Tags', from: 'a', to: 'a, b' },
      { field: 'Focal', from: '—', to: 'Reem' },
    ]);
  });

  it('has nothing to compare for a creation or a deletion', () => {
    expect(changesOf(undefined, { code: 'DAS' })).toEqual([]);
    expect(changesOf({ code: 'DAS' }, null)).toEqual([]);
  });
});
