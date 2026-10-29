import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { GST } from './gst';

const inGst = (value: Date | string) => new TZDate(new Date(value), GST);

/** `29 Sep 2026, 07:00`, in GST (PROMPT §2.15). */
export const formatGst = (value: Date | string): string =>
  format(inGst(value), 'd MMM yyyy, HH:mm');
/** `29 Sep 2026`, in GST. */
export const formatGstDate = (value: Date | string): string => format(inGst(value), 'd MMM yyyy');
/** `07:00`, in GST. */
export const formatGstTime = (value: Date | string): string => format(inGst(value), 'HH:mm');
/** `2026-09-29`: the GST calendar day an instant falls on. */
export const gstDayKey = (value: Date | string): string => format(inGst(value), 'yyyy-MM-dd');
/** `Thursday 15 October 2026`: a GST calendar day (`2026-10-15`) in full. */
export const formatGstLongDay = (day: string): string =>
  format(new TZDate(`${day}T12:00:00`, GST), 'EEEE d MMMM yyyy');
