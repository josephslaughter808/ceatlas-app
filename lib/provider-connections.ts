export type ProviderConnectionStatus = "available" | "planned";

export type SupportedProviderConnection = {
  key: string;
  name: string;
  description: string;
  loginUrl: string;
  loginType: "email_or_username";
  status: ProviderConnectionStatus;
};

export const SUPPORTED_PROVIDER_CONNECTIONS: SupportedProviderConnection[] = [
  {
    key: "adha",
    name: "ADHA CE Smart",
    description: "Use your own ADHA member login to unlock CE Smart courses that are not public.",
    loginUrl: "https://mymembership.adha.org/Members/CE_Smart/Catalog/Course_Catalog.aspx#",
    loginType: "email_or_username",
    status: "available",
  },
  {
    key: "agd",
    name: "AGD Online Learning",
    description: "Queue AGD member login support for private/mastertrack courses and transcript sync.",
    loginUrl: "https://www.agd.org/",
    loginType: "email_or_username",
    status: "planned",
  },
  {
    key: "netce",
    name: "NetCE",
    description: "Prepare to unlock member-only NetCE catalog details and user-scoped completions.",
    loginUrl: "https://www.netce.com/",
    loginType: "email_or_username",
    status: "planned",
  },
  {
    key: "viva",
    name: "Viva Learning",
    description: "Queue private Viva Learning session support for member-only course access.",
    loginUrl: "https://vivalearning.com/",
    loginType: "email_or_username",
    status: "planned",
  },
  {
    key: "spear",
    name: "Spear Education",
    description: "Prepare to connect Spear credentials for gated curriculum and completion sync.",
    loginUrl: "https://www.speareducation.com/",
    loginType: "email_or_username",
    status: "planned",
  },
  {
    key: "dentalxp",
    name: "DentalXP",
    description: "Queue DentalXP account linking for member-only webinar and CE catalog unlocks.",
    loginUrl: "https://www.dentalxp.com/",
    loginType: "email_or_username",
    status: "planned",
  },
  {
    key: "dentaltown",
    name: "Dentaltown CE",
    description: "Queue your Dentaltown login for user-scoped catalog unlocks as we add the session-backed scraper.",
    loginUrl: "https://www.dentaltown.com/login",
    loginType: "email_or_username",
    status: "planned",
  },
  {
    key: "pankey",
    name: "Pankey Institute",
    description: "Prepare to unlock private or member-gated course pages with your own Pankey credentials.",
    loginUrl: "https://pankey.org/",
    loginType: "email_or_username",
    status: "planned",
  },
];

export function getSupportedProviderConnection(key: string) {
  return SUPPORTED_PROVIDER_CONNECTIONS.find((provider) => provider.key === key) || null;
}
