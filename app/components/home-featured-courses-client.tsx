import type { CourseRecord } from "@/lib/courses";
import CourseCard from "./coursecard";

export default function HomeFeaturedCoursesClient({ courses }: { courses: CourseRecord[] }) {
  if (courses.length === 0) {
    return (
      <div className="card">
        <h3>Featured courses are loading a little slowly.</h3>
        <p>The full catalog is still available from the Courses page.</p>
      </div>
    );
  }

  return (
    <div className="course-grid">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
