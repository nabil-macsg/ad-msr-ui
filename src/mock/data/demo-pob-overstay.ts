import { json, notFound } from '../core/http';
import { listRows } from '../core/list';
import { route } from '../core/router';
import { all, find, seed } from '../core/store';
import locationSeeds from './seeds/locations.json';
import zoneSeeds from './seeds/zones.json';

/**
 * Demo pob — Overstay Tracker (original `pob-overstay`): continuous days offshore against the
 * 90-day rule, as at 6 Oct 2026. The 250 longest stays are the original's records; the other
 * people within the limit are generated deterministically so the totals match (1130 people).
 */

export const OVERSTAY_AS_AT = '2026-10-06';
export const OVERSTAY_LIMIT_DAYS = 90;
const APPROACHING_FROM = 75;

export type OverstayStatus = 'Over 90 days' | 'Approaching 90 days' | 'Within limit';

/** One stay at a site within the continuous period offshore. */
export interface OverstayStay {
  siteCode: string;
  site: string;
  arrivedOn: string;
  leftOn: string | null;
  days: number;
}

export interface OverstayPerson {
  id: string;
  name: string;
  optimaId: string;
  company: string;
  category: 'Resident' | 'Contractor' | 'Visitor';
  position: string;
  siteCode: string;
  site: string;
  zoneCode: string;
  zone: string;
  offshoreSince: string;
  days: number;
  /** Days at the current site, when the person moved between sites without going ashore. */
  daysAtSite: number | null;
  status: OverstayStatus;
  stays: OverstayStay[];
}

export interface OverstaySummary {
  asAt: string;
  over: number;
  approaching: number;
  within: number;
  longest: number;
  total: number;
  zones: { code: string; name: string }[];
  sites: { code: string; name: string }[];
}

const SITE_NAME = new Map(locationSeeds.map((l) => [l.code, l.name]));
const SITE_ZONE = new Map(locationSeeds.map((l) => [l.code, l.zone]));
const ZONE_NAME = new Map(zoneSeeds.map((z) => [z.code, z.name]));
/** Offshore sites (every location but the onshore base). */
const SITES = locationSeeds.filter((l) => l.type !== 'BASE').map((l) => l.code);

const CATEGORY = { R: 'Resident', C: 'Contractor', V: 'Visitor' } as const;

type Tuple = [
  name: string,
  optimaId: string,
  company: string,
  category: keyof typeof CATEGORY,
  position: string,
  siteCode: string,
  offshoreSince: string,
  daysAtSite: number | null,
  segments?: [siteCode: string, days: number][],
];

/** The original's records: name, Optima ID, company, category, position, site, since, days at site, stays. */
// prettier-ignore
const ORIGINAL: Tuple[] = [
  ["Antonio Dela Cruz", "OPT-55559", "NPCC", "C", "Auditor", "UAD", "2026-05-25", 18, [["STH", 115], ["UAD", 18]]],
  ["Ibrahim Al Dhaheri", "OPT-32917", "ADNOC Offshore", "R", "Team Lead", "GHF", "2026-06-02", 6, [["UZ", 60], ["BHS", 58], ["GHF", 6]]],
  ["Ahmad Santos", "OPT-78376", "ADNOC Drilling", "R", "Guest Engineer", "ZRK", "2026-06-14", 12, [["BHS", 101], ["ZRK", 12]]],
  ["Ravi Al Dhaheri", "OPT-96555", "Weatherford", "C", "Consultant", "US", "2026-06-14", 2, [["BLB", 56], ["SRB", 54], ["US", 2]]],
  ["Ali Singh", "OPT-15496", "NPCC", "C", "Senior Process Engineer", "ZRK", "2026-06-15", 22, [["STH", 45], ["ZRK-Z1", 44], ["ZRK", 22]]],
  ["Wei Al Dhaheri", "OPT-34183", "ADNOC Offshore", "R", "Operator", "NASR", "2026-06-15", 16, [["UAD", 48], ["STH", 47], ["NASR", 16]]],
  ["Vijay Li", "OPT-25450", "NPCC", "C", "Team Lead", "DAS", "2026-06-21", 17, [["BHS", 89], ["DAS", 17]]],
  ["Hassan Rivera", "OPT-28186", "ADNOC Offshore", "R", "Operator", "UZ", "2026-06-22", 17, [["ZRK-Z2", 88], ["UZ", 17]]],
  ["Yousuf Smith", "OPT-70575", "Halliburton", "C", "Guest Engineer", "ZRK-Z1", "2026-06-30", 2, [["DAS", 95], ["ZRK-Z1", 2]]],
  ["Aisha Taylor", "OPT-75283", "Petrofac", "C", "Guest Engineer", "UZ", "2026-07-10", 11, [["BHS", 38], ["GHF", 37], ["UZ", 11]]],
  ["Ramon Kumar", "OPT-48648", "ADNOC Offshore", "R", "Radar Technician", "ACPT", "2026-07-11", 17, [["ABK", 69], ["ACPT", 17]]],
  ["Anjali Okafor", "OPT-87426", "Weatherford", "C", "Guest Engineer", "SRB", "2026-07-12", 3, [["BLB", 41], ["HAIL", 40], ["SRB", 3]]],
  ["Mohammed Al Dhaheri", "OPT-70768", "ADNOC Offshore", "R", "Operations Supervisor", "UZ", "2026-07-12", 21, [["LZ", 64], ["UZ", 21]]],
  ["Mohammed Patel", "OPT-71914", "Weatherford", "C", "Guest Engineer", "DAS", "2026-07-14", 11, [["BLB", 72], ["DAS", 11]]],
  ["Vijay Al Mansoori", "OPT-11029", "NPCC", "C", "Guest Engineer", "NASR", "2026-07-14", 30, [["HAIL", 53], ["NASR", 30]]],
  ["Carlos Al Mansoori", "OPT-91051", "NPCC", "C", "Field Technician", "LZ", "2026-07-15", 17, [["BHS", 33], ["STH", 31], ["LZ", 17]]],
  ["Ferdinand Sharma", "OPT-34768", "ADNOC Drilling", "R", "Operations Supervisor", "US", "2026-07-17", 3, [["UZ", 77], ["US", 3]]],
  ["Jomar Al Mazrouei", "OPT-72951", "Schlumberger", "C", "Senior Process Engineer", "DAS", "2026-07-17", 13, [["GHF", 34], ["UAS", 32], ["DAS", 13]]],
  ["David Al Hosani", "OPT-11380", "Weatherford", "C", "Field Specialist", "UZ", "2026-07-18", 21, [["ZRK", 29], ["ZRK-Z1", 28], ["UZ", 21]]],
  ["Mohammed Al Shamsi", "OPT-50643", "NPCC", "C", "Radar Technician", "DAS", "2026-07-18", 12, [["ACPT", 34], ["ZRK", 32], ["DAS", 12]]],
  ["Edgar Wang", "OPT-14229", "ADNOC Offshore", "R", "Senior Engineer", "GHF", "2026-07-22", 3, [["UAS", 72], ["GHF", 3]]],
  ["Michael Sharma", "OPT-30317", "NPCC", "C", "Operator", "US", "2026-07-22", 23, [["BLB", 52], ["US", 23]]],
  ["James Dela Cruz", "OPT-61880", "NPCC", "C", "Consultant", "ZRK", "2026-07-23", 26, [["NASR", 48], ["ZRK", 26]]],
  ["Omar Wang", "OPT-65905", "Petrofac", "C", "Senior Process Engineer", "UZ", "2026-07-23", 27, [["CSM", 47], ["UZ", 27]]],
  ["Jomar Singh", "OPT-15706", "Halliburton", "C", "Consultant", "DAS", "2026-07-25", 24, [["ACPT", 48], ["DAS", 24]]],
  ["Ravi Al Blooshi", "OPT-80345", "Schlumberger", "C", "Senior Process Engineer", "NASR", "2026-07-26", 28],
  ["Saeed Al Dhaheri", "OPT-68482", "ADNOC Offshore", "R", "Operator", "ZRK", "2026-07-26", 25],
  ["Ali Santos", "OPT-44267", "Schlumberger", "C", "Operations Supervisor", "GHF", "2026-07-27", 23],
  ["Khalid Al Mansoori", "OPT-74178", "ADNOC Offshore", "R", "Senior Process Engineer", "DAS", "2026-07-27", 24],
  ["Vijay Li", "OPT-75226", "NPCC", "C", "Radar Technician", "DAS", "2026-07-28", 34],
  ["Hassan Al Mazrouei", "OPT-42996", "Petrofac", "C", "Guest Engineer", "UZ", "2026-07-29", 20],
  ["John Al Shamsi", "OPT-84948", "ADNOC Offshore", "R", "Auditor", "SRB", "2026-07-30", 23],
  ["Anjali Al Hosani", "OPT-67591", "Schlumberger", "C", "Service Engineer", "ZRK", "2026-08-02", 23],
  ["Hessa Al Mansoori", "OPT-67701", "ADNOC Offshore", "R", "HDA", "SRB", "2026-08-02", 25],
  ["Michael Smith", "OPT-69845", "NPCC", "C", "Field Specialist", "HAIL", "2026-08-02", 19],
  ["Omar Smith", "OPT-95054", "NPCC", "C", "Operator", "UAD", "2026-08-02", 32],
  ["Grace Al Dhaheri", "OPT-17003", "ADNOC Offshore", "R", "Response Coordinator", "ZRK", "2026-08-03", 15],
  ["Ravi Kumar", "OPT-49591", "ADNOC Drilling", "R", "Senior Engineer", "GHF", "2026-08-03", 17],
  ["Sara Johnson", "OPT-39467", "Halliburton", "C", "Response Coordinator", "UZ", "2026-08-03", 23],
  ["Arun Al Kaabi", "OPT-82947", "Schlumberger", "C", "Guest Engineer", "ZRK", "2026-08-04", 31],
  ["Carlos Al Hosani", "OPT-29893", "Halliburton", "C", "Consultant", "ACPT", "2026-08-04", 24],
  ["Carlos Patel", "OPT-21305", "ADNOC Offshore", "R", "Auditor", "GHF", "2026-08-04", 24],
  ["Hassan Al Kaabi", "OPT-96134", "ADNOC Offshore", "R", "Field Specialist", "DAS", "2026-08-05", 14],
  ["Ravi Al Shamsi", "OPT-78581", "ADNOC Drilling", "R", "Senior Process Engineer", "ZRK", "2026-08-05", 21],
  ["Tariq Al Kaabi", "OPT-13082", "Schlumberger", "C", "Service Engineer", "ZRK", "2026-08-05", 31],
  ["Anil Li", "OPT-78276", "NPCC", "C", "Field Technician", "ABK", "2026-08-06", 29],
  ["Michael Singh", "OPT-13349", "Petrofac", "C", "Senior Engineer", "ACPT", "2026-08-06", 19],
  ["Suresh Okafor", "OPT-52788", "Halliburton", "C", "Radar Technician", "US", "2026-08-07", 25],
  ["Vijay Sharma", "OPT-52928", "NPCC", "C", "Response Coordinator", "BLB", "2026-08-08", 19],
  ["John Johnson", "OPT-48296", "NPCC", "C", "Senior Engineer", "UAD", "2026-08-09", 23],
  ["Carlos Nair", "OPT-15858", "ADNOC Drilling", "R", "Field Specialist", "DAS", "2026-08-10", 27],
  ["Edgar Li", "OPT-29672", "Halliburton", "C", "Radar Technician", "NASR", "2026-08-10", 21],
  ["Robert Okafor", "OPT-12866", "NPCC", "C", "Field Technician", "GHF", "2026-08-10", 11],
  ["Arun Singh", "OPT-89903", "Weatherford", "C", "Service Engineer", "DAS", "2026-08-11", 28],
  ["Edgar Dela Cruz", "OPT-36897", "Lloyd’s Register", "V", "Operator", "GHF", "2026-08-11", 9],
  ["Ferdinand Smith", "OPT-66984", "ADNOC Offshore", "R", "Catering Supervisor", "NASR", "2026-08-11", 15],
  ["Ibrahim Sharma", "OPT-60262", "ADNOC Drilling", "R", "Field Technician", "ZRK", "2026-08-11", 23],
  ["Mohammed Johnson", "OPT-71381", "NPCC", "C", "Field Technician", "NASR", "2026-08-12", 32],
  ["Vijay Williams", "OPT-58981", "NPCC", "C", "Radar Technician", "BLB", "2026-08-12", 16],
  ["Anil Rivera", "OPT-63821", "NPCC", "C", "Consultant", "BHS", "2026-08-13", 33],
  ["Carlos Santos", "OPT-84789", "Halliburton", "C", "Catering Supervisor", "STH", "2026-08-13", 31],
  ["Ravi Al Blooshi", "OPT-91171", "Halliburton", "C", "Consultant", "DAS", "2026-08-13", 5],
  ["Saeed Al Mazrouei", "OPT-78607", "NPCC", "C", "Catering Supervisor", "LZ", "2026-08-13", 11],
  ["Saeed Santos", "OPT-77433", "ADNOC Drilling", "R", "Operations Supervisor", "ACPT", "2026-08-13", 5],
  ["Sara Menon", "OPT-49200", "ADNOC Offshore", "R", "Radar Technician", "US", "2026-08-13", 25],
  ["Michael Al Hosani", "OPT-97671", "ADNOC Offshore", "R", "Field Specialist", "UZ", "2026-08-14", 27],
  ["Anil Sharma", "OPT-13102", "ADNOC Offshore", "R", "HDA", "NASR", "2026-08-15", 18],
  ["John Taylor", "OPT-74386", "ADNOC Offshore", "R", "Guest Engineer", "GHF", "2026-08-15", 8],
  ["Anil Sharma", "OPT-85394", "Halliburton", "C", "Radar Technician", "LZ", "2026-08-16", 5],
  ["Hassan Williams", "OPT-81051", "NPCC", "C", "Consultant", "UAD", "2026-08-16", 2],
  ["Hessa Wang", "OPT-58135", "ADNOC Offshore", "R", "Field Specialist", "GHF", "2026-08-16", 23],
  ["James Santos", "OPT-24814", "Halliburton", "C", "Service Engineer", "GHF", "2026-08-16", 23],
  ["Ramon Singh", "OPT-65050", "Weatherford", "C", "Field Specialist", "LZ", "2026-08-16", 34],
  ["Ferdinand Sharma", "OPT-90013", "ADNOC Offshore", "R", "HLO", "UAS", "2026-08-17", 21],
  ["Omar Li", "OPT-19914", "Weatherford", "C", "Guest Engineer", "ACPT", "2026-08-17", 32],
  ["Ramon Wang", "OPT-96608", "Petrofac", "C", "Guest Engineer", "NASR", "2026-08-17", 30],
  ["Saeed Nair", "OPT-15976", "ADNOC Offshore", "R", "HDA", "BLB", "2026-08-17", 23],
  ["Suresh Sharma", "OPT-53616", "NPCC", "C", "Senior Process Engineer", "DAS", "2026-08-17", 28],
  ["Vijay Garcia", "OPT-82952", "NPCC", "C", "Auditor", "GHF", "2026-08-17", 21],
  ["Antonio Al Blooshi", "OPT-66776", "Petrofac", "C", "Operations Supervisor", "GHF", "2026-08-18", 33],
  ["Chen Taylor", "OPT-62244", "Lloyd’s Register", "V", "Response Coordinator", "UAD", "2026-08-18", 2],
  ["Wei Taylor", "OPT-57394", "Halliburton", "C", "Auditor", "DAS", "2026-08-18", 30],
  ["Chen Menon", "OPT-18034", "ADNOC Offshore", "R", "HLO", "BLB", "2026-08-19", 21],
  ["John Okafor", "OPT-11069", "ADNOC Offshore", "R", "Auditor", "DAS", "2026-08-19", 26],
  ["Jomar Kumar", "OPT-75976", "Schlumberger", "C", "Catering Supervisor", "HAIL", "2026-08-19", 8],
  ["Priya Sharma", "OPT-80164", "Schlumberger", "C", "Service Engineer", "ZRK-Z2", "2026-08-19", 19],
  ["Rajesh Al Shamsi", "OPT-92046", "ADNOC Offshore", "R", "Field Technician", "ZRK", "2026-08-19", 15],
  ["Roberto Al Mazrouei", "OPT-41259", "NPCC", "C", "Senior Engineer", "BHS", "2026-08-19", 15],
  ["David Wang", "OPT-19216", "ADNOC Offshore", "R", "Team Lead", "UZ", "2026-08-20", 8],
  ["Edgar Al Blooshi", "OPT-15360", "ADNOC Offshore", "R", "HRO", "ZRK-Z2", "2026-08-20", 10],
  ["Ibrahim Dela Cruz", "OPT-29657", "NPCC", "C", "Service Engineer", "GHF", "2026-08-20", 0],
  ["Omar Dela Cruz", "OPT-38929", "ADNOC Offshore", "R", "Team Lead", "UZ", "2026-08-20", 24],
  ["Rajesh Wang", "OPT-26730", "Lloyd’s Register", "V", "Field Technician", "UZ", "2026-08-20", 2],
  ["Ravi Al Mansoori", "OPT-13150", "Target Engineering", "V", "Senior Engineer", "ABK", "2026-08-21", 5],
  ["Ahmad Rivera", "OPT-12429", "ADNOC Offshore", "R", "Consultant", "DAS", "2026-08-22", 24],
  ["Ali Dela Cruz", "OPT-87830", "ADNOC Offshore", "R", "HDA", "DAS", "2026-08-22", 15],
  ["Hassan Santos", "OPT-90522", "Petrofac", "C", "Field Technician", "LZ", "2026-08-22", 34],
  ["Saeed Dela Cruz", "OPT-14116", "ADNOC Offshore", "R", "Service Engineer", "ZRK", "2026-08-22", 14],
  ["Khalid Rivera", "OPT-52104", "NPCC", "C", "Operator", "DAS", "2026-08-23", 4],
  ["Maria Li", "OPT-80404", "Halliburton", "C", "Field Specialist", "UAD", "2026-08-23", 12],
  ["Omar Al Mazrouei", "OPT-14104", "ADNOC Offshore", "R", "HRO", "STH", "2026-08-23", 4],
  ["Rajesh Al Dhaheri", "OPT-95752", "ADNOC Offshore", "R", "Guest Engineer", "HAIL", "2026-08-23", 5],
  ["Roberto Li", "OPT-18705", "Target Engineering", "V", "Consultant", "US", "2026-08-23", 8],
  ["Tariq Dela Cruz", "OPT-31464", "ADNOC Drilling", "R", "Catering Supervisor", "UZ", "2026-08-23", 21],
  ["Ahmad Li", "OPT-79540", "NPCC", "C", "Senior Engineer", "UZ", "2026-08-24", 4],
  ["Anil Patel", "OPT-17377", "ADNOC Offshore", "R", "Service Engineer", "DAS", "2026-08-24", 21],
  ["Arun Brown", "OPT-49536", "ADNOC Drilling", "R", "Senior Engineer", "LZ", "2026-08-24", 13],
  ["Arun Dela Cruz", "OPT-46689", "ADNOC Offshore", "R", "Operations Supervisor", "US", "2026-08-24", 3],
  ["Carlos Johnson", "OPT-17786", "Weatherford", "C", "Auditor", "ZRK-Z1", "2026-08-24", 9],
  ["Hassan Al Shamsi", "OPT-29354", "ADNOC Offshore", "R", "Radar Technician", "US", "2026-08-24", 15],
  ["Ahmad Kumar", "OPT-79904", "Petrofac", "C", "Radar Technician", "ACPT", "2026-08-25", 32],
  ["Ali Al Shamsi", "OPT-15350", "NPCC", "C", "Operations Supervisor", "ZRK", "2026-08-25", 1],
  ["Hassan Al Kaabi", "OPT-69515", "Target Engineering", "V", "Senior Process Engineer", "UAD", "2026-08-25", 7],
  ["John Smith", "OPT-36321", "Schlumberger", "C", "Auditor", "ABK", "2026-08-25", 20],
  ["Suresh Al Hosani", "OPT-15560", "ADNOC Offshore", "R", "Service Engineer", "DAS", "2026-08-25", 26],
  ["Tariq Okafor", "OPT-68392", "Halliburton", "C", "Team Lead", "GHF", "2026-08-25", 32],
  ["Yousuf Al Mansoori", "OPT-82234", "Schlumberger", "C", "Response Coordinator", "ACPT", "2026-08-25", 13],
  ["Aisha Al Mansoori", "OPT-52467", "ADNOC Offshore", "R", "Guest Engineer", "UZ", "2026-08-26", 0],
  ["John Al Blooshi", "OPT-44207", "NPCC", "C", "Consultant", "ZRK", "2026-08-26", 25],
  ["Khalid Brown", "OPT-37794", "NPCC", "C", "Consultant", "GHF", "2026-08-26", 26],
  ["Yousuf Menon", "OPT-43960", "Petrofac", "C", "Guest Engineer", "ZRK-Z2", "2026-08-26", 21],
  ["Chen Menon", "OPT-60169", "ADNOC Drilling", "R", "Auditor", "UZ", "2026-08-27", 10],
  ["Fatima Wang", "OPT-74054", "ADNOC Offshore", "R", "Catering Supervisor", "DAS", "2026-08-27", 3],
  ["Grace Wang", "OPT-28154", "NPCC", "C", "Field Technician", "GHF", "2026-08-27", 28],
  ["John Singh", "OPT-38092", "ADNOC Drilling", "R", "Service Engineer", "ZRK-Z2", "2026-08-27", 19],
  ["Robert Al Blooshi", "OPT-71864", "Schlumberger", "C", "Guest Engineer", "UAD", "2026-08-27", 23],
  ["Robert Dela Cruz", "OPT-25833", "Petrofac", "C", "Senior Engineer", "ZRK", "2026-08-27", 2],
  ["Tariq Al Hosani", "OPT-55110", "ADNOC Offshore", "R", "Senior Process Engineer", "UZ", "2026-08-27", 2],
  ["Wei Patel", "OPT-71766", "ADNOC Drilling", "R", "Field Specialist", "ZRK", "2026-08-27", 17],
  ["Ali Brown", "OPT-31850", "ADNOC Offshore", "R", "Field Technician", "NASR", "2026-08-28", 10],
  ["Antonio Al Mansoori", "OPT-82715", "Halliburton", "C", "Response Coordinator", "ZRK", "2026-08-28", 31],
  ["David Al Kaabi", "OPT-64803", "Petrofac", "C", "Radar Technician", "DAS", "2026-08-28", 23],
  ["Tariq Garcia", "OPT-34178", "Halliburton", "C", "Operations Supervisor", "ACPT", "2026-08-28", 21],
  ["Vijay Al Mansoori", "OPT-56813", "NPCC", "C", "Auditor", "GHF", "2026-08-29", 25],
  ["Chen Brown", "OPT-32220", "ADNOC Offshore", "R", "Senior Engineer", "DAS", "2026-08-30", 0],
  ["Chen Al Kaabi", "OPT-68282", "Halliburton", "C", "Operations Supervisor", "LZ", "2026-08-31", 12],
  ["Jomar Williams", "OPT-43549", "ADNOC Offshore", "R", "Operator", "US", "2026-08-31", 18],
  ["Hessa Johnson", "OPT-99201", "Petrofac", "C", "Consultant", "ZRK", "2026-09-01", 28],
  ["Khalid Li", "OPT-82999", "ADNOC Offshore", "R", "Catering Supervisor", "ZRK", "2026-09-01", 15],
  ["Ahmad Smith", "OPT-99041", "ADNOC Offshore", "R", "HDA", "GHF", "2026-09-02", 22],
  ["Ahmad Taylor", "OPT-48148", "Petrofac", "C", "Operator", "DAS", "2026-09-02", null],
  ["Aisha Li", "OPT-45303", "Weatherford", "C", "Field Technician", "GHF", "2026-09-02", null],
  ["Ali Okafor", "OPT-40740", "Halliburton", "C", "Radar Technician", "US", "2026-09-02", null],
  ["Antonio Smith", "OPT-99778", "ADNOC Offshore", "R", "Operator", "LZ", "2026-09-02", 3],
  ["Carlos Smith", "OPT-54877", "Weatherford", "C", "Senior Engineer", "GHF", "2026-09-02", null],
  ["David Brown", "OPT-92209", "ADNOC Drilling", "R", "Catering Supervisor", "DAS", "2026-09-02", 12],
  ["Hassan Dela Cruz", "OPT-81036", "Halliburton", "C", "Service Engineer", "GHF", "2026-09-02", null],
  ["John Al Mazrouei", "OPT-36442", "NPCC", "C", "Operator", "GHF", "2026-09-02", null],
  ["Khalid Al Hosani", "OPT-11782", "Schlumberger", "C", "Senior Process Engineer", "ACPT", "2026-09-02", null],
  ["Khalid Smith", "OPT-30945", "Target Engineering", "V", "Radar Technician", "US", "2026-09-02", 6],
  ["Latifa Smith", "OPT-20750", "Petrofac", "C", "Catering Supervisor", "STH", "2026-09-02", null],
  ["Priya Brown", "OPT-67738", "Halliburton", "C", "Consultant", "DAS", "2026-09-02", null],
  ["Ramon Al Dhaheri", "OPT-87545", "Schlumberger", "C", "Guest Engineer", "LZ", "2026-09-02", null],
  ["Robert Al Dhaheri", "OPT-16810", "Halliburton", "C", "Operations Supervisor", "DAS", "2026-09-02", null],
  ["Roberto Taylor", "OPT-77777", "ADNOC Offshore", "R", "Operations Supervisor", "BHS", "2026-09-02", 17],
  ["Suresh Kumar", "OPT-16334", "NPCC", "C", "Field Specialist", "US", "2026-09-02", null],
  ["Tariq Johnson", "OPT-16184", "Petrofac", "C", "Field Technician", "DAS", "2026-09-02", null],
  ["Ali Li", "OPT-32352", "NPCC", "C", "Catering Supervisor", "DAS", "2026-09-03", null],
  ["Antonio Johnson", "OPT-10384", "ADNOC Drilling", "R", "Senior Process Engineer", "DAS", "2026-09-03", 18],
  ["Carlos Brown", "OPT-99614", "Weatherford", "C", "Response Coordinator", "GHF", "2026-09-03", null],
  ["Ferdinand Smith", "OPT-44514", "Weatherford", "C", "Senior Process Engineer", "DAS", "2026-09-03", null],
  ["John Dela Cruz", "OPT-26875", "NPCC", "C", "Response Coordinator", "NASR", "2026-09-03", null],
  ["Jomar Smith", "OPT-62285", "Schlumberger", "C", "Senior Engineer", "ACPT", "2026-09-03", null],
  ["Khalid Al Blooshi", "OPT-65743", "NPCC", "C", "Operations Supervisor", "LZ", "2026-09-03", null],
  ["Michael Okafor", "OPT-17933", "Petrofac", "C", "Field Specialist", "US", "2026-09-03", null],
  ["Ravi Williams", "OPT-91910", "NPCC", "C", "Senior Process Engineer", "BHS", "2026-09-03", null],
  ["Roberto Wang", "OPT-54401", "Schlumberger", "C", "Operator", "ZRK", "2026-09-03", null],
  ["Saeed Al Dhaheri", "OPT-56167", "NPCC", "C", "Consultant", "UZ", "2026-09-03", null],
  ["Saeed Brown", "OPT-13008", "Halliburton", "C", "Guest Engineer", "GHF", "2026-09-03", null],
  ["Saeed Dela Cruz", "OPT-84117", "NPCC", "C", "Auditor", "ZRK", "2026-09-03", null],
  ["Saeed Dela Cruz", "OPT-43569", "NPCC", "C", "Guest Engineer", "ZRK", "2026-09-03", null],
  ["Vijay Wang", "OPT-27046", "Schlumberger", "C", "Response Coordinator", "ZRK", "2026-09-03", null],
  ["Wei Al Dhaheri", "OPT-72206", "Halliburton", "C", "Field Technician", "DAS", "2026-09-03", null],
  ["Yousuf Al Blooshi", "OPT-62257", "ADNOC Drilling", "R", "Guest Engineer", "DAS", "2026-09-03", 1],
  ["Ahmad Sharma", "OPT-89127", "Schlumberger", "C", "Consultant", "GHF", "2026-09-04", null],
  ["Aisha Singh", "OPT-23671", "Weatherford", "C", "Senior Engineer", "LZ", "2026-09-04", null],
  ["Ali Al Mazrouei", "OPT-28108", "NPCC", "C", "Senior Process Engineer", "STH", "2026-09-04", null],
  ["Carlos Smith", "OPT-56930", "Schlumberger", "C", "Consultant", "SRB", "2026-09-04", null],
  ["Ferdinand Nair", "OPT-60095", "ADNOC Offshore", "R", "Guest Engineer", "BHS", "2026-09-04", 2],
  ["Hassan Li", "OPT-71410", "Halliburton", "C", "Response Coordinator", "DAS", "2026-09-04", null],
  ["John Patel", "OPT-26332", "NPCC", "C", "Field Technician", "HAIL", "2026-09-04", null],
  ["Latifa Taylor", "OPT-81297", "ADNOC Offshore", "R", "Guest Engineer", "US", "2026-09-04", 10],
  ["Rajesh Williams", "OPT-61468", "ADNOC Drilling", "R", "Operations Supervisor", "BHS", "2026-09-04", 18],
  ["Ramon Al Blooshi", "OPT-87658", "Petrofac", "C", "Team Lead", "DAS", "2026-09-04", null],
  ["Robert Al Hosani", "OPT-92697", "Halliburton", "C", "Guest Engineer", "UZ", "2026-09-04", 2],
  ["Tariq Garcia", "OPT-13929", "ADNOC Drilling", "R", "HDA", "UAD", "2026-09-04", 22],
  ["Vijay Kumar", "OPT-97664", "Petrofac", "C", "Auditor", "DAS", "2026-09-04", null],
  ["Anil Menon", "OPT-64105", "Halliburton", "C", "Team Lead", "ACPT", "2026-09-05", null],
  ["Anjali Wang", "OPT-93869", "NPCC", "C", "Auditor", "SRB", "2026-09-05", null],
  ["Carlos Garcia", "OPT-88292", "ADNOC Offshore", "R", "Senior Process Engineer", "DAS", "2026-09-05", 21],
  ["David Singh", "OPT-38676", "NPCC", "C", "Operations Supervisor", "NASR", "2026-09-05", null],
  ["David Wang", "OPT-54985", "NPCC", "C", "Catering Supervisor", "UAD", "2026-09-05", null],
  ["Hassan Santos", "OPT-63230", "Petrofac", "C", "Auditor", "ZRK", "2026-09-05", null],
  ["Latifa Al Shamsi", "OPT-51853", "Petrofac", "C", "Service Engineer", "ZRK-Z1", "2026-09-05", 5],
  ["Michael Kumar", "OPT-97998", "NPCC", "C", "Auditor", "LZ", "2026-09-05", null],
  ["Mohammed Okafor", "OPT-77927", "NPCC", "C", "Team Lead", "GHF", "2026-09-05", null],
  ["Omar Dela Cruz", "OPT-68358", "Petrofac", "C", "Response Coordinator", "UZ", "2026-09-05", null],
  ["Rajesh Smith", "OPT-63402", "NPCC", "C", "Radar Technician", "DAS", "2026-09-05", null],
  ["Saeed Rivera", "OPT-32903", "Weatherford", "C", "Operations Supervisor", "UAD", "2026-09-05", null],
  ["Vijay Taylor", "OPT-26722", "Schlumberger", "C", "Service Engineer", "UZ", "2026-09-05", 0],
  ["Carlos Sharma", "OPT-45501", "NPCC", "C", "Senior Process Engineer", "ZRK", "2026-09-06", 1],
  ["David Smith", "OPT-31696", "Petrofac", "C", "Guest Engineer", "ZRK-Z1", "2026-09-06", null],
  ["David Williams", "OPT-31603", "NPCC", "C", "Operations Supervisor", "ACPT", "2026-09-06", null],
  ["Edgar Al Dhaheri", "OPT-95916", "NPCC", "C", "Response Coordinator", "NASR", "2026-09-06", null],
  ["Edgar Wang", "OPT-80235", "Petrofac", "C", "Senior Engineer", "DAS", "2026-09-06", null],
  ["Ferdinand Sharma", "OPT-67667", "Weatherford", "C", "Catering Supervisor", "BHS", "2026-09-06", null],
  ["Hassan Singh", "OPT-51969", "Halliburton", "C", "Senior Engineer", "GHF", "2026-09-06", null],
  ["Michael Al Shamsi", "OPT-48594", "NPCC", "C", "Auditor", "GHF", "2026-09-06", null],
  ["Omar Al Blooshi", "OPT-19588", "Schlumberger", "C", "Consultant", "ZRK", "2026-09-06", null],
  ["Ravi Rivera", "OPT-42599", "ADNOC Offshore", "R", "Senior Process Engineer", "ZRK", "2026-09-06", 17],
  ["Roberto Wang", "OPT-53205", "NPCC", "C", "Field Technician", "ZRK", "2026-09-06", null],
  ["Suresh Al Dhaheri", "OPT-76576", "NPCC", "C", "Field Specialist", "UZ", "2026-09-06", null],
  ["Suresh Al Hosani", "OPT-51792", "Schlumberger", "C", "Senior Engineer", "SRB", "2026-09-06", 20],
  ["Vijay Al Hosani", "OPT-56366", "Weatherford", "C", "Senior Process Engineer", "US", "2026-09-06", null],
  ["Yousuf Menon", "OPT-22456", "ADNOC Offshore", "R", "HDA", "UAD", "2026-09-06", 13],
  ["Ahmad Li", "OPT-30454", "Petrofac", "C", "Guest Engineer", "GHF", "2026-09-07", null],
  ["Ali Al Blooshi", "OPT-20188", "Petrofac", "C", "Field Specialist", "ZRK", "2026-09-07", null],
  ["Ali Santos", "OPT-74296", "ADNOC Drilling", "R", "Field Specialist", "GHF", "2026-09-07", 18],
  ["Anil Okafor", "OPT-53897", "NPCC", "C", "Catering Supervisor", "UZ", "2026-09-07", null],
  ["Arun Al Blooshi", "OPT-95828", "NPCC", "C", "Response Coordinator", "US", "2026-09-07", null],
  ["Arun Taylor", "OPT-35053", "Weatherford", "C", "Field Specialist", "DAS", "2026-09-07", null],
  ["Carlos Garcia", "OPT-10458", "Petrofac", "C", "Team Lead", "UZ", "2026-09-07", null],
  ["Chen Singh", "OPT-51344", "Halliburton", "C", "Field Specialist", "UZ", "2026-09-07", null],
  ["Edgar Johnson", "OPT-81829", "Halliburton", "C", "Consultant", "GHF", "2026-09-07", null],
  ["Edgar Kumar", "OPT-15442", "NPCC", "C", "Team Lead", "UZ", "2026-09-07", null],
  ["Hessa Rivera", "OPT-73604", "Schlumberger", "C", "Senior Engineer", "GHF", "2026-09-07", null],
  ["John Al Hosani", "OPT-91255", "ADNOC Offshore", "R", "Guest Engineer", "LZ", "2026-09-07", 21],
  ["Khalid Al Blooshi", "OPT-39296", "ADNOC Offshore", "R", "Senior Process Engineer", "DAS", "2026-09-07", 23],
  ["Khalid Wang", "OPT-46352", "Halliburton", "C", "Operations Supervisor", "UZ", "2026-09-07", null],
  ["Michael Sharma", "OPT-27024", "Petrofac", "C", "Senior Process Engineer", "ZRK", "2026-09-07", null],
  ["Omar Wang", "OPT-20331", "Weatherford", "C", "Consultant", "DAS", "2026-09-07", null],
  ["Rajesh Kumar", "OPT-84535", "Halliburton", "C", "Field Technician", "BHS", "2026-09-07", null],
  ["Rajesh Li", "OPT-20920", "Schlumberger", "C", "Consultant", "ZRK", "2026-09-07", null],
  ["Ramon Al Dhaheri", "OPT-92917", "Halliburton", "C", "Auditor", "GHF", "2026-09-07", null],
  ["Ramon Sharma", "OPT-58419", "Petrofac", "C", "Operations Supervisor", "DAS", "2026-09-07", null],
  ["Robert Wang", "OPT-87152", "Weatherford", "C", "Catering Supervisor", "DAS", "2026-09-07", 15],
  ["Tariq Rivera", "OPT-29725", "ADNOC Drilling", "R", "Operator", "ABK", "2026-09-07", 2],
  ["Tariq Wang", "OPT-16664", "NPCC", "C", "Consultant", "GHF", "2026-09-07", 13],
  ["Vijay Al Mansoori", "OPT-28130", "ADNOC Offshore", "R", "Operator", "US", "2026-09-07", 19],
  ["Vijay Pillai", "OPT-60109", "Topaz Marine", "C", "Marine Technician", "DAS", "2026-09-07", null],
  ["Wei Rivera", "OPT-95627", "Petrofac", "C", "Auditor", "GHF", "2026-09-07", null],
  ["Wei Williams", "OPT-60099", "Schlumberger", "C", "Service Engineer", "DAS", "2026-09-07", null],
  ["Yousuf Johnson", "OPT-54730", "NPCC", "C", "Guest Engineer", "GHF", "2026-09-07", null],
  ["Arun Wang", "OPT-76215", "NPCC", "C", "Field Specialist", "BHS", "2026-09-08", null],
  ["Carlos Al Blooshi", "OPT-99541", "ADNOC Offshore", "R", "Field Technician", "NASR", "2026-09-08", 6],
  ["David Sharma", "OPT-63155", "Petrofac", "C", "Service Engineer", "ZRK", "2026-09-08", 12],
  ["Ferdinand Smith", "OPT-39013", "Schlumberger", "C", "Guest Engineer", "DAS", "2026-09-08", null],
  ["Hessa Sharma", "OPT-32596", "Petrofac", "C", "Senior Engineer", "GHF", "2026-09-08", null],
  ["Ibrahim Dela Cruz", "OPT-87185", "NPCC", "C", "Field Specialist", "ABK", "2026-09-08", null],
  ["James Patel", "OPT-49053", "NPCC", "C", "Operations Supervisor", "US", "2026-09-08", null],
];

const DAY = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export const overstayStatus = (days: number): OverstayStatus =>
  days > OVERSTAY_LIMIT_DAYS
    ? 'Over 90 days'
    : days >= APPROACHING_FROM
      ? 'Approaching 90 days'
      : 'Within limit';

/** A deterministic spread of numbers, so the demo shows the same data on every load. */
const spread = (i: number, mod: number) => (i * 7919 + 104_729) % mod;

/** Earlier stays for a person whose original record shows only the days at the current site. */
function earlierSegments(
  i: number,
  siteCode: string,
  days: number,
  atSite: number,
): [string, number][] {
  const before = days - atSite;
  const others = SITES.filter((s) => s !== siteCode);
  const first = others[spread(i, others.length)] ?? 'DAS';
  if (before < 30) return [[first, before]];
  const second = others.filter((s) => s !== first)[spread(i + 3, others.length - 1)] ?? 'ZRK';
  const split = Math.round(before * (0.4 + spread(i, 30) / 100));
  return [
    [first, split],
    [second, before - split],
  ];
}

function person(i: number, t: Tuple): OverstayPerson {
  const [name, optimaId, company, category, position, siteCode, since, atSite, segments] = t;
  const days = daysBetween(since, OVERSTAY_AS_AT);
  const segs: [string, number][] =
    segments ??
    (atSite === null || atSite >= days
      ? [[siteCode, days]]
      : [...earlierSegments(i, siteCode, days, atSite), [siteCode, atSite]]);
  let arrived = since;
  const stays = segs.map(([code, d], n): OverstayStay => {
    const last = n === segs.length - 1;
    const stay = {
      siteCode: code,
      site: SITE_NAME.get(code) ?? code,
      arrivedOn: arrived,
      leftOn: last ? null : addDays(arrived, d),
      days: d,
    };
    arrived = addDays(arrived, d);
    return stay;
  });
  const zoneCode = SITE_ZONE.get(siteCode) ?? 'OTHER';
  return {
    id: `ovs-${optimaId.slice(4)}`,
    name,
    optimaId,
    company,
    category: CATEGORY[category],
    position,
    siteCode,
    site: SITE_NAME.get(siteCode) ?? siteCode,
    zoneCode,
    zone: ZONE_NAME.get(zoneCode) ?? zoneCode,
    offshoreSince: since,
    days,
    daysAtSite: atSite,
    status: overstayStatus(days),
    stays,
  };
}

const FIRST = [
  'Ahmad',
  'Aisha',
  'Ali',
  'Anil',
  'Anjali',
  'Antonio',
  'Arun',
  'Carlos',
  'Chen',
  'David',
  'Edgar',
  'Fatima',
  'Ferdinand',
  'Grace',
  'Hassan',
  'Hessa',
  'Ibrahim',
  'James',
  'John',
  'Jomar',
  'Khalid',
  'Latifa',
  'Maria',
  'Michael',
  'Mohammed',
  'Omar',
  'Priya',
  'Rajesh',
  'Ramon',
  'Ravi',
  'Robert',
  'Roberto',
  'Saeed',
  'Sara',
  'Suresh',
  'Tariq',
  'Vijay',
  'Wei',
  'Yousuf',
];
const LAST = [
  'Al Blooshi',
  'Al Dhaheri',
  'Al Hosani',
  'Al Kaabi',
  'Al Mansoori',
  'Al Mazrouei',
  'Al Shamsi',
  'Brown',
  'Dela Cruz',
  'Garcia',
  'Johnson',
  'Kumar',
  'Li',
  'Menon',
  'Nair',
  'Okafor',
  'Patel',
  'Pillai',
  'Rivera',
  'Santos',
  'Sharma',
  'Singh',
  'Smith',
  'Taylor',
  'Wang',
  'Williams',
];
const EMPLOYER: [string, keyof typeof CATEGORY][] = [
  ['NPCC', 'C'],
  ['ADNOC Offshore', 'R'],
  ['Halliburton', 'C'],
  ['Petrofac', 'C'],
  ['Schlumberger', 'C'],
  ['ADNOC Drilling', 'R'],
  ['Weatherford', 'C'],
  ['Target Engineering', 'C'],
  ['Lloyd’s Register', 'V'],
  ['Topaz Marine', 'C'],
];
const POSITIONS = [
  'Auditor',
  'Catering Supervisor',
  'Consultant',
  'Field Specialist',
  'Field Technician',
  'Guest Engineer',
  'HDA',
  'HLO',
  'HRO',
  'Marine Technician',
  'Operations Supervisor',
  'Operator',
  'Radar Technician',
  'Response Coordinator',
  'Senior Engineer',
  'Senior Process Engineer',
  'Service Engineer',
  'Team Lead',
];
/** Busier sites appear more often, as in the original. */
const WEIGHTED_SITES = [
  'DAS',
  'DAS',
  'DAS',
  'GHF',
  'GHF',
  'ZRK',
  'ZRK',
  'UZ',
  'UZ',
  'US',
  'NASR',
  'LZ',
  'UAD',
  'ACPT',
  'BHS',
  'SRB',
  'ABK',
  'ZRK-Z1',
  'HAIL',
  'BLB',
  'STH',
  'ZRK-Z2',
  'UAS',
  'CSM',
];

/** People within the limit beyond the original's 250 listed (1 to 28 days offshore). */
function generated(count: number): Tuple[] {
  return Array.from({ length: count }, (_, i): Tuple => {
    const [company, category] = EMPLOYER[spread(i, EMPLOYER.length)] ?? ['NPCC', 'C'];
    const days = 1 + spread(i * 3 + 1, 28);
    const atSite = days > 8 && spread(i, 3) === 0 ? 1 + spread(i, days - 1) : null;
    return [
      `${FIRST[spread(i * 5 + 2, FIRST.length)] ?? 'Ali'} ${LAST[spread(i * 11 + 7, LAST.length)] ?? 'Singh'}`,
      `OPT-${String(10_000 + ((i * 6151 + 2909) % 90_000))}`,
      company,
      category,
      POSITIONS[spread(i * 13 + 5, POSITIONS.length)] ?? 'Operator',
      WEIGHTED_SITES[spread(i * 17 + 3, WEIGHTED_SITES.length)] ?? 'DAS',
      addDays(OVERSTAY_AS_AT, -days),
      atSite,
    ];
  });
}

const STORE = 'demo-pob:overstay';
const TOTAL_PEOPLE = 1130;

function people(): OverstayPerson[] {
  const taken = new Set(ORIGINAL.map((t) => t[1]));
  const extra = generated(TOTAL_PEOPLE * 2)
    .filter((t) => !taken.has(t[1]) && (taken.add(t[1]), true))
    .slice(0, TOTAL_PEOPLE - ORIGINAL.length);
  return [...ORIGINAL, ...extra].map((t, i) => person(i, t));
}

const SEARCH = (p: OverstayPerson) => [p.name, p.optimaId, p.company, p.position];

export function registerPobOverstay(): void {
  seed(STORE, people);

  route('GET', '/api/v1/demo/pob/overstay', (req) =>
    json(
      listRows(all<OverstayPerson>(STORE), req.query, {
        search: SEARCH,
        filters: {
          zone: (p, v) => p.zoneCode === v,
          site: (p, v) => p.siteCode === v,
          status: (p, v) => p.status === v,
        },
        sorts: { days: (p) => p.days, offshoreSince: (p) => p.offshoreSince },
        defaultSort: 'days:desc',
        hasActive: false,
      }),
    ),
  );

  route('GET', '/api/v1/demo/pob/overstay/summary', () => {
    const rows = all<OverstayPerson>(STORE);
    const count = (s: OverstayStatus) => rows.filter((p) => p.status === s).length;
    const summary: OverstaySummary = {
      asAt: OVERSTAY_AS_AT,
      over: count('Over 90 days'),
      approaching: count('Approaching 90 days'),
      within: count('Within limit'),
      longest: rows.reduce((max, p) => Math.max(max, p.days), 0),
      total: rows.length,
      zones: zoneSeeds.map((z) => ({ code: z.code, name: z.name })),
      sites: SITES.map((code) => ({ code, name: SITE_NAME.get(code) ?? code })).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
    return json(summary);
  });

  route('GET', '/api/v1/demo/pob/overstay/:id', (req) => {
    const row = find<OverstayPerson>(STORE, req.params.id ?? '');
    return row ? json(row) : notFound('person');
  });
}
