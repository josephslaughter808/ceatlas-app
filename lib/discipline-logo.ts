import type { Discipline } from "./disciplines";

const logoByDiscipline: Record<string, string> = {
  dentistry: "/discipline-logos/default.png",
  medicine: "/discipline-logos/medicine.png",
  nursing: "/discipline-logos/nursing.png",
  pharmacy: "/discipline-logos/pharmacy.png",
  "mental-health": "/discipline-logos/mental-health.png",
  "physical-therapy": "/discipline-logos/physical-therapy.png",
  veterinary: "/discipline-logos/veterinary.png",
  law: "/discipline-logos/law.png",
  accounting: "/discipline-logos/accounting.png",
};

export function getDisciplineLogo(slug?: string | null) {
  return logoByDiscipline[slug || ""] || "/discipline-logos/default.png";
}

export function getDisciplineLogoAlt(discipline?: Pick<Discipline, "name"> | null) {
  return discipline ? `${discipline.name} CEAtlas logo` : "CEAtlas logo";
}
