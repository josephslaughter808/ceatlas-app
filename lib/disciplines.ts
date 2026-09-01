export type Discipline = {
  slug: string;
  name: string;
  shortName: string;
  group: "Healthcare" | "Professional";
  description: string;
  credential: string;
  accent: string;
  live: boolean;
  highlights: string[];
};

export const disciplines: Discipline[] = [
  {
    slug: "dentistry",
    name: "Dentistry",
    shortName: "Dental",
    group: "Healthcare",
    description: "Courses, conferences, hands-on training, cruises, and destination CE for the dental team.",
    credential: "Dental CE",
    accent: "#1d6f68",
    live: true,
    highlights: ["Clinical topics", "State requirements", "Hands-on and travel CE"],
  },
  {
    slug: "medicine",
    name: "Medicine",
    shortName: "Medical",
    group: "Healthcare",
    description: "CME for physicians, advanced practice clinicians, and medical teams across specialties.",
    credential: "CME",
    accent: "#386fa4",
    live: false,
    highlights: ["Specialty CME", "Conferences", "Board and license renewal"],
  },
  {
    slug: "nursing",
    name: "Nursing",
    shortName: "Nursing",
    group: "Healthcare",
    description: "Continuing nursing education for RNs, APRNs, LPNs, and nursing leaders.",
    credential: "CNE / CE",
    accent: "#7a5aa6",
    live: false,
    highlights: ["Clinical practice", "Advanced practice", "License renewal"],
  },
  {
    slug: "pharmacy",
    name: "Pharmacy",
    shortName: "Pharmacy",
    group: "Healthcare",
    description: "Pharmacist and pharmacy technician education organized by topic, credit, and format.",
    credential: "CPE",
    accent: "#347f8c",
    live: false,
    highlights: ["Pharmacotherapy", "Law and safety", "Live and home study"],
  },
  {
    slug: "mental-health",
    name: "Mental & Behavioral Health",
    shortName: "Mental Health",
    group: "Healthcare",
    description: "CE for psychologists, counselors, social workers, and behavioral health professionals.",
    credential: "CE / CEU",
    accent: "#a15c72",
    live: false,
    highlights: ["Clinical methods", "Ethics", "Trauma and wellness"],
  },
  {
    slug: "physical-therapy",
    name: "Physical & Occupational Therapy",
    shortName: "PT & OT",
    group: "Healthcare",
    description: "Practical continuing education for rehabilitation, mobility, and patient care.",
    credential: "CEU",
    accent: "#687d3f",
    live: false,
    highlights: ["Rehabilitation", "Hands-on training", "State renewal"],
  },
  {
    slug: "veterinary",
    name: "Veterinary Medicine",
    shortName: "Veterinary",
    group: "Healthcare",
    description: "Veterinary CE for clinicians, technicians, practices, and specialty teams.",
    credential: "Veterinary CE",
    accent: "#9a6534",
    live: false,
    highlights: ["Clinical specialties", "Practice teams", "Conferences"],
  },
  {
    slug: "law",
    name: "Law",
    shortName: "Legal",
    group: "Professional",
    description: "CLE organized around practice area, jurisdiction, delivery format, and credit type.",
    credential: "CLE",
    accent: "#565d75",
    live: false,
    highlights: ["Practice areas", "Ethics credits", "Jurisdiction rules"],
  },
  {
    slug: "accounting",
    name: "Accounting & Finance",
    shortName: "Accounting",
    group: "Professional",
    description: "CPE for accountants and finance professionals across technical and business topics.",
    credential: "CPE",
    accent: "#8b6d32",
    live: false,
    highlights: ["Tax and audit", "Ethics", "License renewal"],
  },
];

export function getDiscipline(slug: string) {
  return disciplines.find((discipline) => discipline.slug === slug);
}
