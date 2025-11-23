// controllers/attendanceController.js
import { Supabase } from "../db/db.js";
import jwt from "jsonwebtoken";

/**
 * Attendances controller
 * GET /admin/attendance?member_id=...         -> member view (requires member token)
 * GET /admin/attendance?meet_id=...           -> admin view (meeting)
 * GET /admin/attendance?taruf_id=...          -> admin view (taruf)
 *
 * Returns JSON:
 * {
 *   success: true,
 *   valid: true,
 *   attendances: [...],
 *   meetingInfo: [...],   // meetings and/or tarufs rows for frontend convenience
 *   membersInfo: [...],   // member list (admin) or single member (member view)
 *   locations: [...]
 * }
 */
const Attendances = async (req, res) => {
  try {
    // optional token decode (if provided)
    const authHeader =
      req.headers.authorization || req.headers.Authorization || "";
    let decoded = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        decoded = jwt.verify(token, process.env.JWT_KEY);
      } catch (e) {
        decoded = null;
      }
    }

    // prefer explicit query param if present
    const memberIdQuery = req.query.member_id
      ? Number(req.query.member_id)
      : null;

    // If no explicit member_id but the token belongs to a member, use that
    const tokenMemberId =
      decoded && decoded.role === "member"
        ? Number(decoded._id || decoded.id)
        : null;

    const memberIdParam = memberIdQuery || tokenMemberId || null;

    // also support taruf_id for admin view
    const meetIdQuery = req.query.meet_id ? Number(req.query.meet_id) : null;
    const tarufIdQuery = req.query.taruf_id ? Number(req.query.taruf_id) : null;

    // ---- MEMBER VIEW: return only attendances for that member + related meetings/tarufs & locations ----
    if (memberIdParam) {
      // if query param provided AND token exists and token.role === 'member', ensure token._id === memberIdQuery
      if (memberIdQuery && decoded && decoded.role === "member") {
        const tId = Number(decoded._id || decoded.id);
        if (!tId || tId !== memberIdQuery) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }
      }

      // require authentication to view member-specific data (safer)
      if (!decoded) {
        return res
          .status(401)
          .json({ success: false, error: "Authentication required" });
      }

      // fetch attendances for this member
      const { data: attendances = [], error: selectAttendanceError } =
        await Supabase.from("attendances")
          .select("*")
          .eq("member_id", memberIdParam)
          .order("id", { ascending: true });

      if (selectAttendanceError) {
        console.error(
          "Supabase select error (attendances):",
          selectAttendanceError
        );
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      // Collect parent ids by type (meeting vs taruf). Note: meeting_id column stores parent id for both types.
      const meetingIds = [
        ...new Set(
          (attendances || [])
            .filter((a) => String(a.type).toLowerCase() === "meeting")
            .map((a) => (a.meeting_id ? Number(a.meeting_id) : null))
            .filter(Boolean)
        ),
      ];
      const tarufIds = [
        ...new Set(
          (attendances || [])
            .filter((a) => String(a.type).toLowerCase() === "taruf")
            .map((a) => (a.meeting_id ? Number(a.meeting_id) : null))
            .filter(Boolean)
        ),
      ];

      // fetch meeting info
      let meetingInfo = [];
      if (meetingIds.length) {
        const { data: meetingsData = [], error: meetingError } =
          await Supabase.from("meetings")
            .select("*")
            .in("id", meetingIds)
            .order("id", { ascending: true });

        if (meetingError) {
          console.error("Supabase select error (meetings):", meetingError);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }
        meetingInfo = meetingsData;
      }

      // fetch taruf info for tarufIds
      let tarufInfo = [];
      if (tarufIds.length) {
        const { data: tarufData = [], error: tarufError } = await Supabase.from(
          "tarufs"
        )
          .select("*")
          .in("id", tarufIds)
          .order("id", { ascending: true });

        if (tarufError) {
          console.error("Supabase select error (taruf):", tarufError);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }
        tarufInfo = tarufData;
      }

      // collect location ids used by attendances, meetings and tarufs
      const attendanceLocationIds = [
        ...new Set(
          (attendances || [])
            .map((a) => (a.location_id ? Number(a.location_id) : null))
            .filter(Boolean)
        ),
      ];
      const meetingLocationIds = [
        ...new Set(
          (meetingInfo || [])
            .map((m) => (m.location_id ? Number(m.location_id) : null))
            .filter(Boolean)
        ),
      ];
      const tarufLocationIds = [
        ...new Set(
          (tarufInfo || [])
            .map((t) => (t.location_id ? Number(t.location_id) : null))
            .filter(Boolean)
        ),
      ];

      const locationIds = [
        ...new Set([
          ...attendanceLocationIds,
          ...meetingLocationIds,
          ...tarufLocationIds,
        ]),
      ];

      // fetch locations
      let locations = [];
      if (locationIds.length) {
        const { data: locationsData = [], error: locErr } = await Supabase.from(
          "locations"
        )
          .select("*")
          .in("id", locationIds);

        if (locErr) {
          console.error("Supabase select error (locations):", locErr);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }
        locations = locationsData;
      }

      // build map id -> name
      const locationsMap = {};
      locations.forEach((l) => {
        if (l && l.id !== undefined)
          locationsMap[Number(l.id)] =
            l.name ?? l.location_name ?? l.title ?? null;
      });

      // Build quick lookup maps for meetings and tarufs by id (attach location_name too)
      const meetingMap = {};
      meetingInfo.forEach((m) => {
        if (m && m.id !== undefined) {
          meetingMap[Number(m.id)] = {
            ...m,
            location_name: m.location_id
              ? locationsMap[Number(m.location_id)] ?? null
              : m.location_name ?? null,
            date: m.date ?? m.meeting_date ?? null,
            start_time: m.start_time ?? m.from_time ?? null,
            end_time: m.end_time ?? m.to_time ?? null,
          };
        }
      });

      const tarufMap = {};
      tarufInfo.forEach((t) => {
        if (t && t.id !== undefined) {
          tarufMap[Number(t.id)] = {
            ...t,
            location_name:
              t.location_name ??
              (t.location_id
                ? locationsMap[Number(t.location_id)] ?? null
                : null),
            date: t.date ?? null,
            start_time: t.start_time ?? null,
            end_time: t.end_time ?? null,
          };
        }
      });

      // Attach meeting_name & location_name to each attendance based on its type
      const attendancesWithLoc = (attendances || []).map((a) => {
        const copy = { ...a };
        const aType = String(a.type || "meeting").toLowerCase();
        if (aType === "taruf") {
          const info = tarufMap[Number(a.meeting_id)] || null;
          copy.meeting_name = info?.name ?? copy.meeting_name ?? null;
          copy.location_name =
            info?.location_name ?? copy.location_name ?? null;
          copy.event_date = info?.date ?? null;
          copy.event_start_time = info?.start_time ?? null;
          copy.event_end_time = info?.end_time ?? null;
        } else {
          const info = meetingMap[Number(a.meeting_id)] || null;
          copy.meeting_name = info?.name ?? copy.meeting_name ?? null;
          copy.location_name =
            info?.location_name ?? copy.location_name ?? null;
          copy.event_date = info?.date ?? null;
          copy.event_start_time = info?.start_time ?? null;
          copy.event_end_time = info?.end_time ?? null;
        }
        return copy;
      });

      // fetch this member's minimal info
      const { data: memberInfo = null, error: memberError } =
        await Supabase.from("members")
          .select("id, name, email, its_number")
          .eq("id", memberIdParam)
          .maybeSingle();

      if (memberError) {
        console.error("Supabase select error (member):", memberError);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        attendances: attendancesWithLoc,
        meetingInfo: [...meetingInfo, ...tarufInfo], // preserve shape for frontend compatibility
        membersInfo: memberInfo ? [memberInfo] : [],
        locations,
      });
    }

    // ---- ADMIN / DEFAULT BEHAVIOR (support meeting or taruf) ----
    const meetId = meetIdQuery; // maybe null
    const tarufId = tarufIdQuery; // maybe null

    // Require at least one of meetId or tarufId
    if (!meetId && !tarufId) {
      return res
        .status(400)
        .json({ error: "meet_id or taruf_id is required for admin view" });
    }

    // fetch members (active)
    const { data: membersInfo, error: selectMembersInfoError } =
      await Supabase.from("members")
        .select("*")
        .neq("status", 2)
        .order("id", { ascending: true });

    if (selectMembersInfoError) {
      console.error("Supabase select error (members):", selectMembersInfoError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // fetch meeting or taruf info
    let eventInfo = [];
    if (meetId) {
      const { data: meetingInfoData, error: selectMeetingInfoError } =
        await Supabase.from("meetings").select("*").eq("id", meetId);

      if (selectMeetingInfoError) {
        console.error(
          "Supabase select error (meeting):",
          selectMeetingInfoError
        );
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      eventInfo = meetingInfoData || [];
    } else if (tarufId) {
      const { data: tarufInfoData, error: selectTarufInfoError } =
        await Supabase.from("tarufs").select("*").eq("id", tarufId);

      if (selectTarufInfoError) {
        console.error("Supabase select error (taruf):", selectTarufInfoError);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      // return taruf rows in the same key so frontend doesn't need changes
      eventInfo = tarufInfoData || [];
    }

    // fetch attendances filtered by meet_id or taruf_id (stored in meeting_id column)
    const attendQuery = Supabase.from("attendances")
      .select("*")
      .order("id", { ascending: true });
    if (meetId) attendQuery.eq("meeting_id", meetId);
    if (tarufId) attendQuery.eq("meeting_id", tarufId);

    const { data: attendances, error: selectAttendanceError } =
      await attendQuery;

    if (selectAttendanceError) {
      console.error(
        "Supabase select error (attendances admin):",
        selectAttendanceError
      );
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // collect location ids and fetch them (same as member branch)
    const attendanceLocationIds = [
      ...new Set(
        (attendances || [])
          .map((a) => (a.location_id ? Number(a.location_id) : null))
          .filter(Boolean)
      ),
    ];
    const eventLocationIds = [
      ...new Set(
        (eventInfo || [])
          .map((m) => (m.location_id ? Number(m.location_id) : null))
          .filter(Boolean)
      ),
    ];
    const locationIds = [
      ...new Set([...attendanceLocationIds, ...eventLocationIds]),
    ];

    let locations = [];
    if (locationIds.length) {
      const { data: locationsData = [], error: locErr } = await Supabase.from(
        "locations"
      )
        .select("*")
        .in("id", locationIds);

      if (locErr) {
        console.error("Supabase select error (locations admin):", locErr);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      locations = locationsData;
    }

    const locationsMap = {};
    locations.forEach((l) => {
      if (l && l.id !== undefined)
        locationsMap[Number(l.id)] =
          l.name ?? l.location_name ?? l.title ?? null;
    });

    const eventInfoWithLoc = (eventInfo || []).map((m) => ({
      ...m,
      location_name: m.location_id
        ? locationsMap[Number(m.location_id)] ?? null
        : null,
    }));

    const attendancesWithLoc = (attendances || []).map((a) => ({
      ...a,
      location_name: a.location_id
        ? locationsMap[Number(a.location_id)] ?? null
        : null,
    }));

    return res.status(200).json({
      success: true,
      valid: true,
      attendances: attendancesWithLoc,
      meetingInfo: eventInfoWithLoc,
      membersInfo,
      locations,
    });
  } catch (err) {
    console.error("attendance error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Attendances };
