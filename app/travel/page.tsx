import { getCourses } from "@/lib/courses";
import TravelPlannerClient from "../components/travel-planner-client";

export const dynamic = "force-dynamic";

export default async function TravelPage() {
  const courses = await getCourses();

  return (
    <div className="container">
      <TravelPlannerClient courses={courses} />
      <section className="travel-cta-strip">
        <div className="card">
          <h2>Ready for real checkout?</h2>
          <p>Create your account now so card setup, purchase history, and future trip checkout all live in one place.</p>
          <a className="button" href="/account">Open account</a>
        </div>
      </section>
    </div>
  );
}
