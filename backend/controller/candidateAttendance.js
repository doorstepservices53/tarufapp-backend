import { Supabase } from "../db/db.js";
// Helper function to validate and sanitize an ID to prevent object errors
const validateAndSanitizeId = (id, name) => {
  if (typeof id === "object" && id !== null) {
    console.error(
      `[CRITICAL] Attempted to pass object for ${name}: ${JSON.stringify(id)}`
    );
    return null;
  }
  if (!id) {
    return null;
  }
  // Ensure IDs are treated as strings for consistency in Supabase filters
  return String(id).trim();
};

/**
 * FIX: Retrieves candidate list and current attendance records for a specific Taruf ID.
 * Route: GET /admin/candidate_attendance?taruf_id=...
 */
export const getCandidateAttendanceData = async (req, res) => {
  const tarufId = validateAndSanitizeId(req.query.taruf_id, "taruf_id (query)");

  if (!tarufId) {
    return res
      .status(400)
      .json({ error: "Missing or invalid Taruf ID parameter." });
  }

  try {
    // 1. Fetch all candidate information for this Taruf
    const { data: candidatesInfo, error: candidatesError } =
      await Supabase.from("registrations")
        .select("its_number:itsNumber, name, id")
        .eq("taruf_id", tarufId);

    if (candidatesError) throw new Error(candidatesError.message);

    // 2. Fetch existing attendance records
    const { data: attendances, error: attendancesError } = await Supabase.from(
      "attendances"
    )
      .select("candidate_its, datetime, id")
      .eq("meeting_id", tarufId);

    if (attendancesError) throw new Error(attendancesError.message);

    // NOTE: The `select` method automatically maps `snake_case` to `camelCase`
    // if you use aliases like `its_number:itsNumber`.

    res.status(200).json({ attendances, candidatesInfo });
  } catch (err) {
    console.error(
      `Error in getCandidateAttendanceData: ${err.message}`,
      err.stack
    );
    res.status(500).json({
      error: "Candidate Attendance Fetch Error",
      detail: err.message,
    });
  }
};

/**
 * Handles individual attendance marking (upsert).
 * Route: POST /admin/candidate_attendance
 */
export const addIndividualCandidateAttendance = async (req, res) => {
  let { member_id, itsNumber, tarufId } = req.body;

  const finalItsNumber = validateAndSanitizeId(itsNumber, "itsNumber (body)");
  const finalTarufId = validateAndSanitizeId(tarufId, "tarufId (body)");

  if (!finalItsNumber || !finalTarufId) {
    return res.status(400).json({
      error: "Missing or invalid ITS number or Taruf ID in request body.",
    });
  }

  if (!member_id) {
    member_id = 0; // or handle as per your logic
  }

  const payload = {
    member_id: member_id,
    candidate_its: finalItsNumber,
    meeting_id: finalTarufId,
    type: "taruf",
    // Explicitly set the timestamp, mirroring the original `NOW()`
    datetime: new Date().toISOString(),
  };

  try {
    // Supabase `upsert` handles the `INSERT ... ON CONFLICT DO UPDATE` logic
    const { data: resultData, error: upsertError } = await Supabase.from(
      "attendances"
    )
      .upsert(payload, "type, candidate_its, meeting_id")
      .select(); // Fetches the inserted/updated row

    if (upsertError) throw new Error(upsertError.message);

    res.status(200).json({ attendance: resultData[0] });
  } catch (err) {
    console.error(
      `Error adding individual attendance for ITS ${finalItsNumber}: ${err.message}`,
      err.stack
    );
    res.status(500).json({
      error: "Error adding individual candidate attendance.",
      detail: err.message,
    });
  }
};

/**
 * Handles bulk attendance marking (bulk upsert).
 * Route: POST /admin/candidate_attendances
 */
export const bulkAddCandidateAttendance = async (req, res) => {
  const { member_id, taruf_id, candidates } = req.body;

  const finalTarufId = validateAndSanitizeId(taruf_id, "taruf_id (bulk body)");

  if (!finalTarufId || !Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({
      error: "Missing or invalid Taruf ID or candidates list for bulk add.",
    });
  }
  if (!member_id) {
    member_id = 0; // or handle as per your logic
  }

  // Create an array of objects for bulk upsert
  const records = candidates.map((its) => ({
    member_id,
    candidate_its: String(its),
    meeting_id: finalTarufId,
    datetime: new Date().toISOString(),
  }));

  try {
    // Supabase handles the bulk upsert automatically
    const { data: resultData, error: bulkError } = await Supabase.from(
      "attendances"
    )
      .upsert(records, { onConflict: "candidate_its,meeting_id" })
      .select();

    if (bulkError) throw new Error(bulkError.message);

    res.status(200).json({
      message: `Successfully added/updated ${resultData.length} attendance records.`,
      attendances: resultData,
    });
  } catch (err) {
    console.error(
      `Error in bulkAddCandidateAttendance: ${err.message}`,
      err.stack
    );
    res.status(500).json({
      error: "Error during bulk attendance addition.",
      detail: err.message,
    });
  }
};

/**
 * Handles deleting an attendance record.
 * Route: DELETE /admin/candidate_attendance/:itsNumber/:tarufId
 */
export const deleteIndividualCandidateAttendance = async (req, res) => {
  const itsNumber = validateAndSanitizeId(
    req.params.itsNumber,
    "itsNumber (param)"
  );
  const tarufId = validateAndSanitizeId(req.params.tarufId, "tarufId (param)");

  if (!itsNumber || !tarufId) {
    return res
      .status(400)
      .json({ error: "Missing or invalid ITS number or Taruf ID in URL." });
  }

  try {
    const { data, error, count } = await Supabase.from("attendances")
      .delete()
      .eq("candidate_its", itsNumber)
      .eq("meeting_id", tarufId)
      .select(); // Selecting deleted data to confirm removal

    if (error) throw new Error(error.message);

    if (data.length === 0) {
      return res
        .status(404)
        .json({ error: "Attendance record not found to delete." });
    }

    res
      .status(200)
      .json({ message: "Attendance record deleted successfully." });
  } catch (err) {
    console.error(
      `Error deleting attendance for ITS ${itsNumber}: ${err.message}`,
      err.stack
    );
    res.status(500).json({
      error: "Error deleting candidate attendance.",
      detail: err.message,
    });
  }
};
// NOTE: Replaced `module.exports` with individual `export const`
