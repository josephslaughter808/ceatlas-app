export default function HomePage() {
  return (
    <div className="container">

      {/* HERO SECTION */}
      <section style={{ padding: "4rem 0" }}>
        <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
          Continuing Education, Simplified
        </h1>

        <p style={{ fontSize: "1.25rem", maxWidth: "600px", marginBottom: "2rem" }}>
          CEAtlas helps dental professionals find, compare, and track the best CE courses — all in one clean, easy-to-use platform.
        </p>

        <a href="/courses" className="button">
          Browse Courses
        </a>
      </section>

      {/* VALUE PROPOSITION */}
      <section style={{ marginTop: "4rem" }}>
        <div style={{ 
          display: "grid", 
          gap: "2rem", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" 
        }}>
          
          <div className="card">
            <h3>Find Courses Fast</h3>
            <p>Search and filter hundreds of CE courses from trusted providers.</p>
          </div>

          <div className="card">
            <h3>Compare Providers</h3>
            <p>See course details, locations, dates, and credits at a glance.</p>
          </div>

          <div className="card">
            <h3>Stay Organized</h3>
            <p>Track upcoming sessions and build your CE plan effortlessly.</p>
          </div>

        </div>
      </section>

      {/* FEATURED COURSES */}
      <section style={{ marginTop: "4rem" }}>
        <h2 style={{ marginBottom: "1.5rem" }}>Featured Courses</h2>

        <div style={{ 
          display: "grid", 
          gap: "2rem", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" 
        }}>
          
          <div className="card">
            <h3>Orthodontic Wire Techniques</h3>
            <p>Learn modern wire bending and bracket placement.</p>
            <a href="/courses" className="button" style={{ marginTop: "1rem", display: "inline-block" }}>
              View Course
            </a>
          </div>

          <div className="card">
            <h3>Periodontal Therapy Advanced</h3>
            <p>Deep dive into periodontal treatment strategies.</p>
            <a href="/courses" className="button" style={{ marginTop: "1rem", display: "inline-block" }}>
              View Course
            </a>
          </div>

          <div className="card">
            <h3>Cosmetic Veneers Masterclass</h3>
            <p>Master veneer preparation and aesthetic design.</p>
            <a href="/courses" className="button" style={{ marginTop: "1rem", display: "inline-block" }}>
              View Course
            </a>
          </div>

        </div>
      </section>

      
    </div>
  );
}
1