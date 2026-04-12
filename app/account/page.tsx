import { Suspense } from "react";
import AccountClient from "../components/account-client";

export default function AccountPage() {
  return (
    <div className="container">
      <Suspense fallback={null}>
        <AccountClient />
      </Suspense>
    </div>
  );
}
