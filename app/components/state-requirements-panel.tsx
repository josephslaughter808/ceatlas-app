"use client";

import Link from "next/link";
import {
  getPracticeStateResource,
} from "@/lib/practice-states";

export default function StateRequirementsPanel({
  stateCode,
  providerSuggestions = [],
  signedIn = false,
  compact = false,
}: {
  stateCode: string | null | undefined;
  providerSuggestions?: string[];
  signedIn?: boolean;
  compact?: boolean;
}) {
  const resource = getPracticeStateResource(stateCode);

  if (!resource) {
    return (
      <div className={`state-requirements ${compact ? "state-requirements--compact" : ""}`}>
        <div className="state-requirements__head">
          <div>
            <p className="packages-builder__eyebrow">State CE Requirements</p>
            <h2>{signedIn ? "Add your practice state" : "Plan with your state in mind"}</h2>
          </div>
        </div>
        <p className="state-requirements__copy">
          {signedIn
            ? "Choose your state of practice in your account so CEAtlas can keep the right renewal resources visible while you browse courses and build plans."
            : "Create an account and choose your state of practice so CEAtlas can keep the right renewal resources visible while you browse and plan CE."}
        </p>
        <div className="account-actions">
          <Link href={signedIn ? "/account" : "/account"} className="travel-secondary">
            {signedIn ? "Update account" : "Create account"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`state-requirements ${compact ? "state-requirements--compact" : ""}`}>
      <div className="state-requirements__head">
        <div>
          <p className="packages-builder__eyebrow">State CE Requirements</p>
          <h2>{resource.name}</h2>
        </div>
        <span className="account-chip">{resource.code}</span>
      </div>

      <p className="state-requirements__copy">
        {resource.disclaimer}
      </p>

      <div className="state-requirements__grid">
        {resource.planningChecklist.map((item) => (
          <div key={item} className="state-requirements__item">
            {item}
          </div>
        ))}
      </div>

      {providerSuggestions.length > 0 ? (
        <>
          <p className="packages-builder__eyebrow">State-linked providers already in CEAtlas</p>
          <div className="account-chip-row">
            {providerSuggestions.map((provider) => (
              <span key={provider} className="account-chip">{provider}</span>
            ))}
          </div>
        </>
      ) : null}

      <div className="account-actions">
        <a className="travel-secondary" href={resource.licensureMapUrl} target="_blank" rel="noreferrer">
          Open ADA licensure map
        </a>
        <a className="travel-secondary" href={resource.stateBoardsUrl} target="_blank" rel="noreferrer">
          Open state board directory
        </a>
      </div>
    </div>
  );
}
