// controllers/addAttendanceMaster.js
import { Supabase } from "../db/db.js";
import jwt from "jsonwebtoken";

/**
 * POST /admin/attendances
 * body: { meet_id: number, members: [memberId, ...] }
 * Inserts attendance rows for the specified members for given meeting (if not already present).
 * Requires Admin token.
 */

const addAttendanceMaster = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    let decoded = null;
    if (authHeader.startsWith("Bearer ")) {
      try {
        decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_KEY);
      } catch (e) {
        decoded = null;
      }
    }
    if (!decoded || decoded.role !== "admin") {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required (admin)" });
    }

    const { meet_id, members } = req.body ?? {};
    if (!meet_id || !Array.isArray(members) || members.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "meet_id and members[] required" });
    }

    const now = new Date();

    // fetch existing attendance for this meeting + those members to avoid duplicates
    const { data: existing = [], error: existErr } = await Supabase.from(
      "attendances"
    )
      .select("id,member_id")
      .eq("meeting_id", meet_id)
      .in("member_id", members);
    if (existErr) throw existErr;

    const existingMemberIds = new Set(
      (existing || []).map((r) => Number(r.member_id))
    );

    const toInsert = members
      .filter((m) => !existingMemberIds.has(Number(m)))
      .map((m) => ({
        meeting_id: meet_id,
        member_id: m,
        datetime: now,
      }));

    if (toInsert.length === 0) {
      return res.json({ success: true, message: "No new attendances to add" });
    }

    const { data: insertRes, error: insertErr } = await Supabase.from(
      "attendances"
    )
      .insert(toInsert)
      .select("*");
    if (insertErr) throw insertErr;

    return res.json({ success: true, inserted: insertRes });
  } catch (err) {
    console.error("addAttendanceMaster error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { addAttendanceMaster };
