import { Suspense } from 'react';
import { Navigate } from 'react-router';
import { FullScreenSpinner } from '../../shared/ui/spinner';
import { can, type PageKey, pageOf, routeOf } from '../access/registry';
import { BUILT_PAGES } from '../pages/built-pages';
import { NotBuiltYet } from '../pages/NotBuiltYet';
import { useMyAccess } from '../session/queries';

export interface DeniedState {
  readonly deniedPage: string;
}

/**
 * Every registry route renders through this guard: without the page's view right the user
 * goes Home with a notice (PROMPT §2.7). The API enforces the same rights on every call.
 */
export function RequirePage({ pageKey }: { pageKey: PageKey }) {
  const { data: access } = useMyAccess();
  const page = pageOf(pageKey);
  if (!can(access, pageKey)) {
    const state: DeniedState = { deniedPage: page.label };
    return <Navigate to={routeOf('home')} replace state={state} />;
  }
  const Built = page.heldBy ? undefined : BUILT_PAGES[pageKey];
  if (!Built) return <NotBuiltYet page={page} />;
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Built />
    </Suspense>
  );
}
