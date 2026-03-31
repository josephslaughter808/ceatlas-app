import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json() as {
      courseId?: string;
      overallRating?: number;
      contentRating?: number;
      instructorRating?: number;
      logisticsRating?: number;
      valueRating?: number;
      comment?: string;
    };

    const courseId = String(body.courseId || "").trim();
    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId." }, { status: 400 });
    }

    const payload = {
      course_id: courseId,
      user_id: user.id,
      overall_rating: Number(body.overallRating || 0),
      content_rating: Number(body.contentRating || 0),
      instructor_rating: Number(body.instructorRating || 0),
      logistics_rating: Number(body.logisticsRating || 0),
      value_rating: Number(body.valueRating || 0),
      comment: String(body.comment || "").trim() || null,
    };

    const { error } = await supabaseAdmin
      .from("course_ratings")
      .upsert(payload, { onConflict: "course_id,user_id" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to save rating.",
    }, { status: 500 });
  }
}
