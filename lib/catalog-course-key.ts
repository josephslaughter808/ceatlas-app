import type { PhysicianCourse } from "./physician-courses";

export function getCatalogCourseKey(course: PhysicianCourse) {
  const metadataId = course.metadata?.accme_activity_id || course.metadata?.cebroker_offering_id || course.metadata?.cebroker_course_id;
  if (metadataId) return String(metadataId).replace(/[^a-zA-Z0-9_-]/g, "-");
  const value = `${course.provider}|${course.title}|${course.url}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `course-${(hash >>> 0).toString(36)}`;
}
