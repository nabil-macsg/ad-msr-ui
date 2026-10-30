import { registerPobEmergency } from '../data/demo-pob-emergency';
import { registerPobOverstay } from '../data/demo-pob-overstay';
import { registerPobRecords } from '../data/demo-pob-records';
import { registerPobReports } from '../data/demo-pob-reports';
import { registerPobSites } from '../data/demo-pob-sites';

/** Mock API for the demo pob screens (src/demo/pob); each area keeps its data and routes. */
export function registerDemoPob(): void {
  registerPobSites();
  registerPobOverstay();
  registerPobRecords();
  registerPobEmergency();
  registerPobReports();
}
