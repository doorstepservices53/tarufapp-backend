// controllers/meetings.js  (or wherever your Meetings handler lives)
import { Supabase } from "../db/db.js";

const Meetings = async (req, res) => {
  try {
    // === PUT / POST handlers will run below, but still return list on GET ===

    // === EDIT / UPDATE handler ===
    if (req.method === "PUT") {
      try {
        const raw = req.body || {};

        const id = raw.id ?? raw.meeting_id ?? null;
        const name = raw.name ?? null;

        // accept both camelCase and snake_case for start/end
        const startTime =
          raw.startTime ?? raw.start_time ?? raw.from_time ?? null;
        const endTime = raw.endTime ?? raw.end_time ?? raw.to_time ?? null;
        const date = raw.date ?? raw.meeting_date ?? null;

        // accept either location (string) or numeric id location_id
        const locationParam = raw.location ?? raw.location_id ?? null;

        const agenda = raw.agenda ?? null;
        const notes = raw.notes ?? null;

        if (!id) {
          return res
            .status(400)
            .json({ success: false, error: "Missing meeting id" });
        }

        // validation
        if (!name || !date || !startTime || !endTime) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields (name, date, startTime, endTime)",
          });
        }

        // optional date format check
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({
            success: false,
            error: "Invalid date format (expected YYYY-MM-DD)",
          });
        }

        // build update row
        const updateRow = {
          name,
          // store numeric location_id if provided as id, else null
          location_id:
            locationParam !== undefined &&
            locationParam !== null &&
            !Number.isNaN(Number(locationParam))
              ? Number(locationParam)
              : null,
          // you may also want to store the location string somewhere, adapt if required
          date,
          start_time: startTime,
          end_time: endTime,
          agenda: agenda ?? null,
          notes: notes ?? null,
          updated_at: new Date().toISOString(),
        };

        const meetingId = Number(id);
        const { data: updated, error: updateError } = await Supabase.from(
          "meetings"
        )
          .update(updateRow)
          .eq("id", meetingId)
          .select()
          .single();

        if (updateError) {
          console.error("Supabase update error:", updateError);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }

        if (!updated) {
          return res
            .status(404)
            .json({ success: false, error: "Meeting not found" });
        }

        return res.status(200).json({ success: true, meeting: updated });
      } catch (err) {
        console.error("UpdateMeeting error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    // === CREATE handler ===
    if (req.method === "POST") {
      try {
        const raw = req.body || {};

        const name = raw.name ?? null;
        const date = raw.date ?? raw.meeting_date ?? null;
        const startTime =
          raw.startTime ?? raw.start_time ?? raw.from_time ?? null;
        const endTime = raw.endTime ?? raw.end_time ?? raw.to_time ?? null;
        const locationParam = raw.location ?? raw.location_id ?? null;
        const agenda = raw.agenda ?? null;
        const notes = raw.notes ?? null;

        if (!name || !date || !startTime || !endTime) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields (name, date, startTime, endTime)",
          });
        }

        // optional date format validation
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({
            success: false,
            error: "Invalid date format (expected YYYY-MM-DD)",
          });
        }

        const row = {
          name,
          location_id:
            locationParam !== undefined &&
            locationParam !== null &&
            !Number.isNaN(Number(locationParam))
              ? Number(locationParam)
              : null,
          date,
          start_time: startTime,
          end_time: endTime,
          agenda: agenda ?? "no agenda",
          notes: notes ?? "no notes",
          status: 1,
          created_at: new Date().toISOString(),
        };

        const { data, error } = await Supabase.from("meetings")
          .insert([row])
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }

        return res.status(201).json({ success: true, meeting: data });
      } catch (err) {
        console.error("createMeeting error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    // === GET: list meetings ===
    if (req.method === "GET") {
      const { data: meetings, error: selectMeetingError } = await Supabase.from(
        "meetings"
      )
        .select("*")
        .neq("status", 2)
        .order("date", { ascending: false });

      if (selectMeetingError) {
        console.error("Supabase select error:", selectMeetingError);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      return res.status(200).json({ success: true, meetings });
    }

    // other methods not allowed
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  } catch (err) {
    console.error("Meetings handler error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Meetings };
