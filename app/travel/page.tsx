import TravelPlannerClient from "../components/travel-planner-client";

export default function TravelPage() {
  return (
    <div className="container">
      <TravelPlannerClient />
      <section className="travel-cta-strip">
        <div className="card">
          <h2>Ready for real checkout?</h2>
          <p>Create your account now so card setup, purchase history, and future trip checkout all live in one place.</p>
          <a className="button" href="/account?mode=signin&returnTo=%2Ftravel">Open account</a>
        </div>
      </section>
    </div>
  );
}
