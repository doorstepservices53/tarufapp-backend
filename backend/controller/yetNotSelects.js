import { Supabase } from "../db/db.js";

// --- Helper Function: Robust ITS Extraction (FIXED) ---
const extractIts = (registrationRow) => {
  // We need to check for multiple possible column names for the candidate ITS
  // as defined in the Supabase 'registrations' table.
  const itsVal =
    registrationRow.itsNumber ??
    registrationRow.its_number ??
    registrationRow.its ??
    registrationRow.ITS ??
    null;

  if (itsVal !== null && typeof itsVal !== "undefined") {
    // Return the cleaned, stringified value for comparison
    return String(itsVal).trim();
  }
  return null;
};

/* ----- Controller: Get Registrations by taruf_id (Original for legacy use) ----- */
export const getRegistrations = async (req, res) => {
  console.log("getRegistrations called");
  const { taruf_id } = req.query;
  if (!taruf_id)
    return res.status(400).json({ success: false, error: "taruf_id required" });

  try {
    const { data, error } = await Supabase.from("registrations")
      .select("*")
      .eq("taruf_id", taruf_id)
      .order("badgeNo", { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ----- Controller: Get Round1 Selected by taruf_id (Original for legacy use) ----- */
export const getRound1Selected = async (req, res) => {
  const { taruf_id } = req.query;
  if (!taruf_id)
    return res.status(400).json({ success: false, error: "taruf_id required" });

  try {
    const { data, error } = await Supabase.from("round1_selected")
      .select("*")
      .eq("taruf_id", taruf_id);

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ----- Controller: Get Candidates Not Selectors (FIXED AND OPTIMIZED) ----- */
export const getCandidatesNotSelectors = async (req, res) => {
  const { taruf_id } = req.query;
  if (!taruf_id)
    return res.status(400).json({ success: false, error: "taruf_id required" });

  try {
    // 1. Fetch all registrations and round1 selections in parallel
    const [regsResp, r1Resp] = await Promise.all([
      Supabase.from("registrations").select("*").eq("taruf_id", taruf_id).order("badgeNo", { ascending: true }),
      Supabase.from("round1_selected").select("*").eq("taruf_id", taruf_id),
    ]);

    if (regsResp.error) throw regsResp.error;
    if (r1Resp.error) throw r1Resp.error;

    const registrations = regsResp.data || [];
    const round1Rows = r1Resp.data || [];

    // 2. Build Set of Selector ITS numbers (robustly checking multiple keys)
    const selectorSet = new Set();
    round1Rows.forEach((r) => {
      const itsVal =
        r.selector_its ??
        r.selectorIts ??
        r.selector_its_number ??
        r.selectorItsNumber ??
        null;

      if (itsVal !== null && typeof itsVal !== "undefined") {
        selectorSet.add(String(itsVal).trim());
      }
    });

    // 3. Filter registrations to find candidates who are NOT selectors
    const filtered = registrations.filter((reg) => {
      const its = extractIts(reg); // Using the fixed helper

      // Must have an ITS AND that ITS must NOT be in the selectorSet
      return its && !selectorSet.has(its);
    });

    res
      .status(200)
      .json({ success: true, data: filtered, total: filtered.length });
  } catch (err) {
    console.error("Error in getCandidatesNotSelectors:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
