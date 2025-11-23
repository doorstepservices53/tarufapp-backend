// controllers/updateAttendance.js
import { Supabase } from "../db/db.js";
import jwt from "jsonwebtoken";

/**
 * PUT /admin/updateAttendance
 * Body: { member_id, meeting_id, type: 'meeting'|'taruf', datetime? }
 *
 * Notes:
 * - attendance table uses meeting_id column to store the parent id for both
 *   meetings and tarufs (distinguished by `type`).
 * - this controller checks the proper parent table (meetings or tarufs)
 *   based on `type` before inserting.
 */
export const updateAttendance = async (req, res) => {
  try {
    // ---------------- AUTH (admin required) ----------------
    const authHeader = req.headers.authorization || "";
    let decoded = null;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        decoded = jwt.verify(token, process.env.JWT_KEY);
      } catch (e) {
        decoded = null;
      }
    }

    if (!decoded || (decoded.role !== "admin" && decoded.role !== "Admin")) {
      return res
        .status(401)
        .json({ success: false, error: "Authentication required (admin)" });
    }

    // ---------------- PARSE & VALIDATE INPUT ----------------
    const member_id = Number(req.body?.member_id || 0);
    const meeting_id = req.body?.meeting_id
      ? Number(req.body.meeting_id)
      : null;
    const rawType = String(req.body?.type || "meeting").toLowerCase();
    const type = rawType === "taruf" ? "taruf" : "meeting";
    const datetime = req.body?.datetime || new Date().toISOString();

    if (!member_id || !meeting_id) {
      return res.status(400).json({
        success: false,
        error: `${!member_id ? "member_id is required. " : ""}${
          !meeting_id ? "meeting_id is required." : ""
        }`,
      });
    }

    // ---------------- DETERMINE PARENT TABLE ----------------
    const parentTable = type === "taruf" ? "tarufs" : "meetings";

    // Check parent exists and is not disabled (if it has status)
    const { data: parentArr = [], error: parentErr } = await Supabase.from(
      parentTable
    )
      .select("*")
      .eq("id", meeting_id)
      .limit(1);

    if (parentErr) {
      console.error(`DB error fetching ${parentTable}:`, parentErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (!parentArr || parentArr.length === 0) {
      return res.status(404).json({
        success: false,
        error: `${parentTable.slice(0, -1)} not found`,
      });
    }

    // If parent has status column and it's 2 => unavailable
    const parentRow = parentArr[0];
    if (
      Object.prototype.hasOwnProperty.call(parentRow, "status") &&
      parentRow.status === 2
    ) {
      return res.status(400).json({
        success: false,
        error: `${parentTable.slice(0, -1)} not available`,
      });
    }

    // ---------------- CHECK EXISTING ATTENDANCE ----------------
    // We always filter on meeting_id column in attendances table, and also on type
    const { data: existing = [], error: existErr } = await Supabase.from(
      "attendances"
    )
      .select("*")
      .eq("meeting_id", meeting_id)
      .eq("member_id", member_id)
      .eq("type", type)
      .order("datetime", { ascending: false })
      .limit(1);

    if (existErr) {
      console.error("DB error checking existing attendance:", existErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (existing && existing.length > 0) {
      // Already present — return existing record
      return res.json({
        success: true,
        message: "Already marked",
        attendance: existing[0],
        inserted: [existing[0]],
      });
    }

    // ---------------- INSERT NEW ATTENDANCE ----------------
    const insertObj = {
      member_id,
      meeting_id, // parent id stored in meeting_id column for both types
      type,
      datetime,
    };

    const { data: inserted = [], error: insertErr } = await Supabase.from(
      "attendances"
    )
      .insert([insertObj])
      .select("*");

    if (insertErr) {
      console.error("DB error inserting attendance:", insertErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    return res.json({
      success: true,
      message: "Attendance marked",
      attendance: inserted[0] || null,
      inserted,
    });
  } catch (err) {
    console.error("updateAttendance error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export default updateAttendance;
