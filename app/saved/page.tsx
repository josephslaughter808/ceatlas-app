import SavedPlanningClient from "../components/saved-planning-client";

export default function SavedPage() {
  return (
    <div className="container">
      <section className="page-header">
        <h1>Saved Planning Board</h1>
        <p>
          Keep your CE shortlist in one place now, then layer flights, hotels, and rental cars onto the same trip plan.
        </p>
      </section>

      <section className="saved-overview">
        <div className="card saved-overview__card">
          <h2>Saved Courses</h2>
          <p>Your bookmarked CE options live here and can also be filtered inside the catalog.</p>
        </div>
        <div className="card saved-overview__card">
          <h2>Flights Ready</h2>
          <p>Use the travel planner to jump from a saved course into live flight searches built around that trip.</p>
        </div>
        <div className="card saved-overview__card">
          <h2>Hotels & Cars Ready</h2>
          <p>Hotels and rental cars now plug into the same itinerary flow, even before direct booking APIs are connected.</p>
        </div>
      </section>

      <SavedPlanningClient />
    </div>
  );
}
