import { registerEngines } from './engines';
import { registerGenericMasters } from './generic-masters';
import { registerModules } from './modules';
import { registerPlaces } from './places';
import { registerPlatform } from './platform';
import { registerResources } from './resources';
import { registerScheduling } from './scheduling';
import { registerSession } from './session';

let registered = false;

/** Registers every demo service; specific routes are registered after the generic master fallback. */
export function registerServices(): void {
  if (registered) return;
  registered = true;
  registerGenericMasters();
  registerSession();
  registerPlatform();
  registerPlaces();
  registerResources();
  registerEngines();
  registerScheduling();
  registerModules();
}
