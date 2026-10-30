import { lazy } from 'react';
import type { BuiltPages } from '../../app/pages/built-pages';

/** Demo screens aligned with the original ADNOC LMS demo, by page key. */
export const BOOKING_CREATE_PAGES: BuiltPages = {
  'booking.create': lazy(() => import('./CreateBookingPage')),
  'booking.bulk': lazy(() => import('./BulkBookingPage')),
  'freight.requests': lazy(() => import('./FreightRequestsPage')),
  'freight.create': lazy(() => import('./FreightCreatePage')),
};
