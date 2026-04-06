import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Missing provider link id." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("linked_provider_accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to remove provider link.",
    }, { status: 500 });
  }
}

