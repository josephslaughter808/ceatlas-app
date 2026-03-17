export default function CourseCard({ course }: { course: any }) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>

      {/* TOP: Instructor photo + title */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
        <img 
          src={course.instructorPhoto || "https://via.placeholder.com/70"} 
          alt={course.instructor}
          style={{
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            objectFit: "cover",
            marginRight: "1rem"
          }}
        />

        <div>
          <h2 style={{ margin: "0 0 0.25rem 0" }}>{course.title}</h2>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#555" }}>
            Instructor: {course.instructor}
          </p>
        </div>
      </div>

      {/* DESCRIPTION */}
      <p style={{ margin: "0.25rem 0" }}>{course.description}</p>

      {/* DETAILS */}
      <p style={{ margin: "0.25rem 0" }}><strong>Location:</strong> {course.location}</p>
      <p style={{ margin: "0.25rem 0" }}><strong>Next Session:</strong> {course.session}</p>
      <p style={{ margin: "0.25rem 0" }}><strong>Credits:</strong> {course.credits}</p>

      {/* BUTTON RIGHT-ALIGNED */}
      <div style={{ 
        display: "flex", 
        justifyContent: "flex-end",
        marginTop: "0.75rem"
      }}>
        <a href={`/courses/${course.id}`} className="button">
          View Details
        </a>
      </div>

    </div>
  );
}
