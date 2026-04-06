export type PracticeStateOption = {
  code: string;
  name: string;
};

export const ADA_LICENSURE_MAP_URL = "https://www.ada.org/resources/careers/licensure/dental-licensure-by-state-map";
export const ADA_STATE_BOARDS_URL = "https://www.ada.org/resources/careers/licensure/student-licensure";

export const PRACTICE_STATES: PracticeStateOption[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const PRACTICE_STATE_MAP = new Map(PRACTICE_STATES.map((state) => [state.code, state]));

export function normalizePracticeStateCode(value: string | null | undefined) {
  const code = String(value || "").trim().toUpperCase();
  return PRACTICE_STATE_MAP.has(code) ? code : "";
}

export function getPracticeStateName(value: string | null | undefined) {
  const code = normalizePracticeStateCode(value);
  return code ? PRACTICE_STATE_MAP.get(code)?.name || code : null;
}

export function getPracticeStateResource(value: string | null | undefined) {
  const code = normalizePracticeStateCode(value);
  const name = getPracticeStateName(code);

  if (!code || !name) {
    return null;
  }

  return {
    code,
    name,
    licensureMapUrl: ADA_LICENSURE_MAP_URL,
    stateBoardsUrl: ADA_STATE_BOARDS_URL,
    planningChecklist: [
      "Confirm your renewal cycle and total CE-hour requirement with your state board.",
      "Double-check topic-specific mandates such as ethics, infection control, opioid prescribing, sedation, or jurisprudence.",
      "Use CEAtlas planning tools to line up courses early enough to finish before your renewal deadline.",
    ],
    disclaimer:
      "CE and renewal rules can change. CEAtlas uses ADA licensure resources as a planning guide, but your state board remains the final authority.",
  };
}
