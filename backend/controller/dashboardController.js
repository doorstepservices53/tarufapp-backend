import { Supabase } from "../db/db.js";

const Dashboard = async (req, res) => {
  try {
    // Get current date in Asia/Kolkata, formatted YYYY-MM-DD
    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    )
      .toISOString()
      .split("T")[0];

    // Meetings: include related location (assumes meetings.location_id -> locations.id FK)
    const { data: meetingsRows, error: selectMeetingError } =
      await Supabase.from("meetings")
        .select("*, location:locations(name)") // include location object
        .gte("date", today)
        .neq("status", 2)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

    if (selectMeetingError) {
      console.error("Supabase select error (meetings):", selectMeetingError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // Timings -> tarufs: fetch timings for date >= today and include related taruf and its location
    // Assumes timings.taruf_id FK to tarufs.id and tarufs.location_id FK to locations.id
    const { data: timingRows, error: selectTimingError } = await Supabase.from(
      "timings"
    )
      .select(
        "id, date, start_time, end_time, taruf_id, taruf:tarufs(*, location:locations(*))"
      )
      .gte("date", today)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (selectTimingError) {
      console.error("Supabase select error (timings):", selectTimingError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // Build tarufs array: attach timing info to each taruf, and filter out status===2
    const tarufs = (timingRows || [])
      .filter(
        (t) =>
          // filter timing-level status if present
          t.status !== 2 &&
          // filter out when related taruf has status=2 or is missing
          t.taruf &&
          t.taruf.status !== 2
      )
      .map((t) => {
        const parent = t.taruf || {};
        const parentLocation = parent.location || null;
        const locationName =
          (parentLocation && parentLocation.name) ||
          (parentLocation && parentLocation.location_name) ||
          null;

        return {
          // include taruf fields
          ...parent,
          // attach timing specifics (overwrites parent fields if collision)
          timing_id: t.id,
          taruf_id: t.taruf_id,
          date: t.date,
          start_time: t.start_time,
          end_time: t.end_time,
          // expose location as a simple string (name) to avoid "Objects are not valid as a React child"
          location: locationName,
        };
      });

    // Normalize meetings: convert nested location object to simple location name string
    const meetings = (meetingsRows || []).map((m) => {
      const locObj = m.location || null;
      const locationName =
        (locObj && (locObj.name || locObj.location_name)) || null;

      return {
        ...m,
        // replace nested object with simple string for direct rendering
        location: locationName,
        // keep original object if needed
        location_obj: locObj,
      };
    });

    return res.status(200).json({
      success: true,
      valid: true,
      meetings,
      tarufs,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Dashboard };
