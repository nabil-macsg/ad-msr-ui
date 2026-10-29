import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import type { components } from '../../api/schema';
import type { MasterResource } from '../administration/masters/master-resource';

export type Support = components['schemas']['Support'];
export type Article = components['schemas']['SupportArticle'];
type ArticleInput = components['schemas']['SupportArticleInput'];

export const SUPPORT_KEY = ['support'] as const;
const ifMatch = (version: number) => ({ 'If-Match': String(version) });

export function useSupport() {
  return useQuery({
    queryKey: [...SUPPORT_KEY, 'page'],
    queryFn: async () => unwrap(await api.GET('/api/v1/support')),
  });
}

export const articlesResource: MasterResource<Article> = {
  pageKey: 'admin.support-articles',
  queryKey: [...SUPPORT_KEY, 'articles'],
  path: '/api/v1/support-articles',
  list: async (query) => unwrap(await api.GET('/api/v1/support-articles', { params: { query } })),
  deactivate: async (article, reason) =>
    unwrap(
      await api.POST('/api/v1/support-articles/{id}/deactivate', {
        params: { path: { id: article.id }, header: ifMatch(article.version) },
        body: { reason },
      }),
    ),
  reactivate: async (article, reason) =>
    unwrap(
      await api.POST('/api/v1/support-articles/{id}/reactivate', {
        params: { path: { id: article.id }, header: ifMatch(article.version) },
        body: { reason },
      }),
    ),
  remove: async (article, reason) => {
    unwrap(
      await api.DELETE('/api/v1/support-articles/{id}', {
        params: { path: { id: article.id }, header: ifMatch(article.version) },
        body: { reason },
      }),
    );
  },
  history: async (id, cursor) =>
    unwrap(
      await api.GET('/api/v1/support-articles/{id}/history', {
        params: { path: { id }, query: cursor ? { cursor } : {} },
      }),
    ),
};

export async function saveArticle(current: Article | null, body: ArticleInput): Promise<void> {
  if (current) {
    // The code is permanent: an edit sends the rest.
    unwrap(
      await api.PUT('/api/v1/support-articles/{id}', {
        params: { path: { id: current.id }, header: ifMatch(current.version) },
        body: { kind: body.kind, title: body.title, body: body.body, sortOrder: body.sortOrder },
      }),
    );
    return;
  }
  unwrap(await api.POST('/api/v1/support-articles', { body }));
}
