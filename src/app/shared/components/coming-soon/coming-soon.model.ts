import { Route } from '@angular/router';

/** Everything a "coming soon" page needs to describe the module it stands in for. */
export interface ComingSoonInfo {
  title: string;
  /** Bootstrap Icons class, e.g. `bi-person-gear`. */
  icon: string;
  /** One sentence on what the module will do. */
  summary: string;
  /** What is planned, shown as a checklist. */
  features: readonly string[];
}

const DATA_KEY = 'comingSoon';

/** Route `data` carrying the page content; read back with {@link comingSoonInfo}. */
export const comingSoonData = (info: ComingSoonInfo): Route['data'] => ({ [DATA_KEY]: info });

export const comingSoonInfo = (data: Route['data']): ComingSoonInfo => data?.[DATA_KEY] as ComingSoonInfo;
