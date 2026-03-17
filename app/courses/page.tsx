import CourseCard from "../components/coursecard";


export default function CoursesPage() {
  return (
    <div className="container">

      {/* PAGE TITLE */}
      <h1 style={{ fontSize: "2.5rem", marginBottom: "2rem" }}>
        All CE Courses
      </h1>

      {/* SEARCH + FILTER BAR */}
      {/* SEARCH + FILTER BAR */}
<div 
  style={{ 
    display: "flex", 
    flexWrap: "wrap",
    gap: "1rem",
    marginBottom: "2rem",
    alignItems: "center"
  }}
>
  {/* SEARCH BAR */}
  <input
    type="text"
    placeholder="Search courses..."
    style={{
      flex: "1",
      minWidth: "250px",
      padding: "0.75rem 1rem",
      borderRadius: "var(--radius)",
      border: "1px solid #ccc",
      fontSize: "1rem"
    }}
  />

  {/* FILTER: INSTRUCTOR */}
  <select
    style={{
      padding: "0.75rem 1rem",
      borderRadius: "var(--radius)",
      border: "1px solid #ccc",
      fontSize: "1rem"
    }}
  >
    <option value="">Instructor</option>
    <option value="smith">Dr. Smith</option>
    <option value="johnson">Dr. Johnson</option>
  </select>

  {/* FILTER: LOCATION */}
  <select
    style={{
      padding: "0.75rem 1rem",
      borderRadius: "var(--radius)",
      border: "1px solid #ccc",
      fontSize: "1rem"
    }}
  >
    <option value="">Location</option>
    <option value="tx">Texas</option>
    <option value="az">Arizona</option>
    <option value="co">Colorado</option>
  </select>

  {/* FILTER: THEME */}
  <select
    style={{
      padding: "0.75rem 1rem",
      borderRadius: "var(--radius)",
      border: "1px solid #ccc",
      fontSize: "1rem"
    }}
  >
    <option value="">Theme</option>
    <option value="ortho">Orthodontics</option>
    <option value="perio">Periodontics</option>
    <option value="cosmetic">Cosmetic Dentistry</option>
  </select>

  {/* FILTER: COURSE HOURS */}
  <select
    style={{
      padding: "0.75rem 1rem",
      borderRadius: "var(--radius)",
      border: "1px solid #ccc",
      fontSize: "1rem"
    }}
  >
    <option value="">Course Hours</option>
    <option value="1-3">1–3 hours</option>
    <option value="4-6">4–6 hours</option>
    <option value="7+">7+ hours</option>
  </select>
</div>


      {/* COURSE LIST */}
      {/* COURSE LIST */}
<div 
  style={{ 
    display: "grid", 
    gap: "2rem",
    gridTemplateColumns: "1fr"
  }}
>
  {/* Example Course Card */}
  <div className="card" style={{ padding: "2rem" }}>
    <h2 style={{ marginBottom: "0.5rem" }}>Orthodontic Wire Techniques</h2>
    <p style={{ marginBottom: "1rem" }}>
      Learn modern wire bending and bracket placement.
    </p>

    <p><strong>Instructor:</strong> Dr. Smith</p>
    <p><strong>Location:</strong> Houston, TX</p>
    <p><strong>Next Session:</strong> March 20, 2026</p>
    <p><strong>Credits:</strong> 6 hours</p>

    <div style={{ 
  display: "flex", 
  justifyContent: "flex-end", 
  marginTop: "1.5rem" 
}}>
  <a href="/courses/1" className="button">
    View Details
  </a>
</div>

  </div>

  {/* Duplicate this card for now — later we’ll load real data */}
  <div className="card" style={{ padding: "2rem" }}>
    <h2 style={{ marginBottom: "0.5rem" }}>Periodontal Therapy Advanced</h2>
    <p style={{ marginBottom: "1rem" }}>
      Deep dive into periodontal treatment strategies.
    </p>

    <p><strong>Instructor:</strong> Dr. Johnson</p>
    <p><strong>Location:</strong> Phoenix, AZ</p>
    <p><strong>Next Session:</strong> March 27, 2026</p>
    <p><strong>Credits:</strong> 4 hours</p>

    <a 
      href="/courses/2" 
      className="button" 
      style={{ marginTop: "1rem", display: "inline-block" }}
    >
      View Details
    </a>
  </div>
</div>


    </div>
  );
}
