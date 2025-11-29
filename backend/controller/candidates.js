// server/controllers/candidates.js
import { Supabase } from "../db/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_KEY = process.env.JWT_KEY || "dev_jwt_key";

// ---------------- common handlers (kept your previous logic mostly intact) ----------------
const getActiveTarufs = async (req, res) => {
  try {
    const { data, error } = await Supabase.from("tarufs")
      .select("id, name")
      .eq("status", 1);
    if (error) {
      console.error("Supabase getActiveTarufs error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    return res.status(200).json({ success: true, tarufs: data || [] });
  } catch (err) {
    console.error("getActiveTarufs error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const checkRegistration = async (req, res) => {
  try {
    const { taruf_id, itsNumber } = req.body;
    if (!taruf_id || !itsNumber) {
      return res
        .status(400)
        .json({ success: false, error: "Missing taruf_id or itsNumber" });
    }

    const { data: registration, error } = await Supabase.from("registrations")
      .select("id, itsNumber, password, name, taruf_id")
      .eq("taruf_id", taruf_id)
      .eq("itsNumber", itsNumber)
      .order("badgeNo", { ascending: true })
      .maybeSingle();

    if (error) {
      console.error("Supabase checkRegistration error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (!registration) {
      return res.status(200).json({ success: true, found: false });
    }

    return res.status(200).json({ success: true, found: true, registration });
  } catch (err) {
    console.error("checkRegistration error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const setPassword = async (req, res) => {
  try {
    const { registration_id, password } = req.body;
    if (!registration_id || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Missing registration_id or password" });
    }
    if (!/^\d{6}$/.test(password)) {
      return res
        .status(400)
        .json({ success: false, error: "Password must be exactly 6 digits" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const { error } = await Supabase.from("registrations")
      .update({ password: hashed })
      .eq("id", registration_id)
      .order("badgeNo", { ascending: true });
    if (error) {
      console.error("Supabase setPassword update error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    const token = jwt.sign(
      { _id: registration_id, role: "candidate" },
      JWT_KEY,
      { expiresIn: "10d" }
    );

    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error("setPassword error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const candidateLogin = async (req, res) => {
  try {
    const { registration_id, password } = req.body;
    if (!registration_id || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Missing registration_id or password" });
    }

    const { data: reg, error } = await Supabase.from("registrations")
      .select("id, itsNumber, password, name, taruf_id")
      .eq("id", registration_id)
      .order("badgeNo", { ascending: true })
      .maybeSingle();

    if (error) {
      console.error("Supabase candidateLogin error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (!reg) {
      return res
        .status(404)
        .json({ success: false, error: "Registration not found" });
    }
    if (!reg.password) {
      return res.status(400).json({
        success: false,
        error: "Password not set for this registration",
      });
    }

    const ok = await bcrypt.compare(password, reg.password);
    if (!ok) {
      return res
        .status(401)
        .json({ success: false, error: "Incorrect password" });
    }

    const token = jwt.sign({ _id: reg.id, role: "candidate" }, JWT_KEY, {
      expiresIn: "10d",
    });

    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error("candidateLogin error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const getRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json({ success: false, error: "Missing id" });

    const { data: registrationData, error: regError } = await Supabase.from(
      "registrations"
    )
      .select("*, tarufs(*)")
      .order("badgeNo", { ascending: true })
      .eq("id", id)
      .maybeSingle();

    if (regError) {
      console.error("Supabase getRegistration error:", regError);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (!registrationData)
      return res
        .status(404)
        .json({ success: false, error: "Registration not found" });

    const sanitizedRegistration = { ...registrationData };
    delete sanitizedRegistration.password;
    delete sanitizedRegistration.ipAddress;
    delete sanitizedRegistration.userAgent;

    let finalTaruf = registrationData.tarufs || null;

    if (finalTaruf && finalTaruf.id) {
      const taruf_id = finalTaruf.id;
      const location_id = finalTaruf.location_id;

      const { data: multipleTimingsData, error: timingsError } =
        await Supabase.from("timings")
          .select("date, start_time, end_time")
          .eq("taruf_id", taruf_id)
          .order("created_at", { ascending: true });

      if (timingsError) {
        console.error("Supabase getRegistration timings error:", timingsError);
      }

      const timingsData =
        multipleTimingsData && multipleTimingsData.length > 0
          ? multipleTimingsData[0]
          : null;

      let locationName = null;
      if (location_id) {
        const { data: locationData, error: locationError } =
          await Supabase.from("locations")
            .select("name")
            .eq("id", location_id)
            .maybeSingle();
        if (locationError) {
          console.error(
            "Supabase getRegistration location error:",
            locationError
          );
        }
        locationName = locationData?.name;
      }

      finalTaruf = {
        ...finalTaruf,
        date: timingsData?.date || finalTaruf.date || "TBA",
        start_time: timingsData?.start_time || finalTaruf.start_time || "—",
        end_time: timingsData?.end_time || finalTaruf.end_time || "—",
        location_name: locationName || "—",
      };
    }

    return res.status(200).json({
      success: true,
      registration: sanitizedRegistration,
      taruf: finalTaruf,
    });
  } catch (err) {
    console.error("getRegistration error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const listRegistrations = async (req, res) => {
  try {
    const taruf_id = req.query.taruf_id;
    if (!taruf_id) {
      return res
        .status(400)
        .json({ success: false, error: "Missing taruf_id query param" });
    }

    const { data, error } = await Supabase.from("registrations")
      .select(
        `id, itsNumber, name, photo1Url, dateOfBirth, currentCity, gender, taruf_id`
      )
      .eq("taruf_id", Number(taruf_id))
      .order("badgeNo", { ascending: true });

    if (error) {
      console.error("listRegistrations error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    return res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    console.error("listRegistrations error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json({ success: false, error: "Missing id" });

    const { data, error } = await Supabase.from("registrations")
      .select("*")
      .eq("id", id)
      .order("badgeNo", { ascending: true })
      .maybeSingle();

    if (error) {
      console.error("getRegistrationById error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (!data)
      return res
        .status(404)
        .json({ success: false, error: "Registration not found" });

    const sanitized = { ...data };
    delete sanitized.password;
    delete sanitized.ipAddress;
    delete sanitized.userAgent;

    return res.status(200).json({ success: true, data: sanitized });
  } catch (err) {
    console.error("getRegistrationById error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// getRegistrations (kept)
const getRegistrations = async (req, res) => {
  try {
    const taruf_id = req.query.taruf_id;
    const group = req.query.group;
    if (!taruf_id)
      return res
        .status(400)
        .json({ success: false, error: "Missing taruf_id query param" });

    const { data, error } = await Supabase.from("registrations")
      .select("*")
      .eq("taruf_id", taruf_id)
      .eq("group", group)
      .order("badgeNo", { ascending: true });

    if (error) {
      console.error("getRegistrations error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    return res.status(200).json({ success: true, data: data || [] });
  } catch (err) {
    console.error("getRegistrations exception:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// submitRound1 (kept)
const submitRound1 = async (req, res) => {
  try {
    const { taruf_id } = req.params;
    if (!taruf_id)
      return res
        .status(400)
        .json({ success: false, error: "Missing taruf_id" });

    const {
      currentCandidateId,
      currentCandidateIts,
      selector_date_of_birth,
      selector_photo1url,
      selector_first_name,
      selector_last_name,
      selections,
    } = req.body;
    if (!currentCandidateId)
      return res.status(400).json({
        success: false,
        error: "Missing currentCandidateId (selector)",
      });
    if (!Array.isArray(selections) || selections.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No selections provided" });
    }
    if (selections.length > 5) {
      return res
        .status(400)
        .json({ success: false, error: "Max 5 selections allowed" });
    }

    // check if this selector already submitted for this taruf
    const { data: existing, error: existErr } = await Supabase.from(
      "round1_selected"
    )
      .select("id")
      .eq("taruf_id", Number(taruf_id))
      .eq("selector_registration_id", String(currentCandidateId))
      .limit(1);

    if (existErr) {
      console.error("round1_existing check error:", existErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Round1 already submitted by this candidate",
      });
    }

    const filtered = selections.filter((s) => {
      if (!s) return false;
      if (String(s.registration_id) === String(currentCandidateId))
        return false;
      if (
        currentCandidateIts &&
        String(s.itsNumber) === String(currentCandidateIts)
      )
        return false;
      return true;
    });

    const skippedCount = selections.length - filtered.length;
    if (filtered.length === 0) {
      return res
        .status(200)
        .json({ success: true, insertedCount: 0, skippedCount });
    }

    const rows = filtered.map((s) => ({
      taruf_id: Number(taruf_id),
      selector_registration_id: String(currentCandidateId),
      selector_its: currentCandidateIts ?? null,
      selector_date_of_birth,
      selector_photo1url,
      selector_first_name,
      selector_last_name,
      selected_registration_id: String(s.registration_id),
      selected_its: s.itsNumber ? String(s.itsNumber) : null,
      selected_name: s.name || null,
      // selected_last_name: s.lastName || null,
      selected_photo1url: s.photo1Url || null,
      selected_date_of_birth: s.dateOfBirth || null,
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await Supabase.from(
      "round1_selected"
    ).insert(rows);
    if (insertError) {
      console.error("round1_selected insert error:", insertError);
      return res
        .status(500)
        .json({ success: false, error: "Database insert error" });
    }

    return res.status(200).json({
      success: true,
      insertedCount: rows.length,
      skippedCount,
    });
  } catch (err) {
    console.error("submitRound1 error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const getRound1Selected = async (req, res) => {
  try {
    const taruf_id = req.query.taruf_id;

    const selector_id = req.query.selector_id;
    const memberName = req.query.memberName; // Will be undefined if not provided

    if (!taruf_id)
      return res
        .status(400)
        .json({ success: false, error: "Missing taruf_id" });

    // *** REPLACING RPC WITH SIMPLE SELECT QUERY ***
    const { data, error } = await Supabase.from("round1_selected") // Target the table/view
      .select(
        `*, 
  selector_counsellor`
      ) // Select all columns from the table/view
      .eq("taruf_id", Number(taruf_id)); // Filter by taruf_id

    if (error) {
      console.error("getRound1Selected DB error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    let currentData = data || [];
    let memberCandidates = [];
    if (memberName) {
      const { data: memberCandidatesData, error: memberCandidatesError } =
        await Supabase.from("registrations")
          .select("*")
          .ilike("counsellor", `%${memberName}%`);
      if (!memberCandidatesError) {
        memberCandidates = memberCandidatesData;
      }
    }
    if (memberCandidates.length > 0) {
      const memberCandidateIds = new Set(
        memberCandidates.map((c) => String(c.registration_id))
      );
      currentData = currentData.filter(
        (item) =>
          memberCandidateIds.has(String(item.selected_registration_id)) ||
          memberCandidateIds.has(String(item.selector_registration_id))
      );
    }

    // You now have all fields from the round1_selected table/view
    // return res.status(200).json({ success: true, data: data || [] });
    // The data is already flat and joined!
    return res.status(200).json({ success: true, data: currentData || [] });
  } catch (err) {
    console.error("getRound1Selected exception:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// submitRound2 (kept)
const submitRound2 = async (req, res) => {
  try {
    const { taruf_id } = req.params;
    if (!taruf_id)
      return res
        .status(400)
        .json({ success: false, error: "Missing taruf_id" });

    const {
      selector_id,
      selector_its,
      selection,
      selector_name,
      selector_badge,
    } = req.body;
    if (!selector_id || !selection)
      return res
        .status(400)
        .json({ success: false, error: "Missing selector_id or selection" });

    const { data: existing, error: exErr } = await Supabase.from(
      "round1_selected"
    )
      .select("id")
      .eq("taruf_id", Number(taruf_id))
      .eq("selector_registration_id", String(selector_id))
      .limit(1);

    if (exErr) {
      console.error("round1 check error:", exErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (!existing || existing.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Selector did not complete Round 1" });
    }

    const { data: existing2, error: ex2Err } = await Supabase.from(
      "round2_selected"
    )
      .select("id")
      .eq("taruf_id", Number(taruf_id))
      .eq("selector_registration_id", String(selector_id))
      .limit(1);

    if (ex2Err) {
      console.error("round2 duplicate check error:", ex2Err);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    if (existing2 && existing2.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Round2 already submitted by this selector",
      });
    }

    const row = {
      taruf_id: Number(taruf_id),
      selector_registration_id: String(selector_id),
      selector_its: selector_its ?? null,
      selector_name: selector_name,
      selector_badge: selector_badge || null,
      selected_registration_id: String(selection.registration_id),
      selected_its: String(selection.itsNumber),
      selected_name: selection.name,
      selected_badge: selection.badgeNo || null,
      selected_photo1url: selection.photo1Url || null,
      selected_date_of_birth: selection.dateOfBirth || null,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await Supabase.from(
      "round2_selected"
    ).insert(row);
    if (insertError) {
      console.error("round2_selected insert error:", insertError);
      return res
        .status(500)
        .json({ success: false, error: "Database insert error" });
    }

    return res.status(200).json({ success: true, inserted: 1 });
  } catch (err) {
    console.error("submitRound2 error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// addRound1Selection (kept)
const addRound1Selection = async (req, res) => {
  try {
    const { taruf_id } = req.params;
    if (!taruf_id)
      return res
        .status(400)
        .json({ success: false, error: "Missing taruf_id" });

    const {
      selector_id,
      selector_its,
      selector_date_of_birth,
      selector_photo1url,
      selector_first_name,
      selector_last_name,
      selected_registration_id,
      selected_its,
      selected_first_name,
      selected_last_name,
      selected_photo1url,
      selected_date_of_birth,
      selector_name,
      selected_name,
      selector_badge,
      selected_badge,
    } = req.body || {};
    console.log(req.body);
    if (!selector_id || !selected_registration_id) {
      return res.status(400).json({
        success: false,
        error: "Missing selector_id or selected_registration_id",
      });
    }

    const { data: existingRows, error: existErr } = await Supabase.from(
      "round1_selected"
    )
      .select("*")
      .eq("taruf_id", Number(taruf_id))
      .eq("selector_registration_id", String(selector_id));

    if (existErr) {
      console.error("addRound1Selection: check existing error", existErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    const hasRoom =
      existingRows &&
      existingRows.some((r) => {
        const v = r.room_no;
        return v !== null && v !== undefined && String(v).trim() !== "";
      });
    if (hasRoom) {
      return res
        .status(400)
        .json({ success: false, error: "Selections locked, room assigned" });
    }

    const count = existingRows ? existingRows.length : 0;
    if (count >= 5) {
      return res
        .status(400)
        .json({ success: false, error: "Max 5 selections allowed" });
    }

    const already =
      existingRows &&
      existingRows.find(
        (r) =>
          String(r.selected_registration_id) ===
          String(selected_registration_id)
      );
    if (already) {
      return res
        .status(400)
        .json({ success: false, error: "Candidate already selected" });
    }
    console.log(selector_id, "selector_id");
    const { data: counsellorData, error: counsellorErr } = await Supabase.from(
      "registrations"
    )
      .select("counsellor")
      .eq("taruf_id", Number(taruf_id))
      .eq("id", String(selector_id));

    if (counsellorErr) {
      console.error(
        "addRound1Selection: counsellor fetch error",
        counsellorErr
      );
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // 🎯 THE FIX: Extract the counsellor name correctly
    const selectorCounsellor =
      counsellorData && counsellorData.length > 0
        ? counsellorData[0].counsellor
        : null; // Set to null if no data found

    const row = {
      taruf_id: Number(taruf_id),
      selector_registration_id: String(selector_id),
      selector_its: selector_its ?? null,
      selector_counsellor: selectorCounsellor,
      selector_date_of_birth,
      selector_photo1url,
      selector_first_name,
      selector_last_name,
      selected_registration_id: String(selected_registration_id),
      selected_its: selected_its ? String(selected_its) : null,
      selected_first_name: selected_first_name ?? null,
      selected_last_name: selected_last_name ?? null,
      selected_photo1url: selected_photo1url ?? null,
      selected_date_of_birth: selected_date_of_birth ?? null,
      created_at: new Date().toISOString(),
      selector_name: selector_name ?? null,
      selected_name: selected_name ?? null,
      selector_badge: selector_badge ?? null,
      selected_badge: selected_badge ?? null,
    };
    console.log(row);

    const { data: inserted, error: insertErr } = await Supabase.from(
      "round1_selected"
    )
      .insert(row)
      .select()
      .single();

    if (insertErr) {
      console.error("addRound1Selection insertErr:", insertErr);
      return res
        .status(500)
        .json({ success: false, error: "Database insert error" });
    }

    return res.status(200).json({ success: true, row: inserted });
  } catch (err) {
    console.error("addRound1Selection exception:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// deleteRound1Selection (kept)
const deleteRound1Selection = async (req, res) => {
  try {
    const { taruf_id } = req.params;
    const { selector_id, selected_registration_id } = req.query;
    const numeric_selector_id = selector_id;
    const numeric_selected_id = parseInt(selected_registration_id);

    const { data, error } = await Supabase.from("round1_selected")
      .delete()
      .eq("taruf_id", Number(taruf_id))
      .eq("selector_registration_id", numeric_selector_id)
      .eq("selected_registration_id", numeric_selected_id)
      .select();

    if (error) {
      console.error("Supabase deleteRound1Selection error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Database error during deletion" });
    }

    if (data && data.length > 0) {
      return res.status(200).json({
        success: true,
        deleted: data.length,
        message: "Selection deleted successfully",
      });
    } else {
      return res.status(404).json({
        success: false,
        error: "Selection not found or already deleted",
      });
    }
  } catch (err) {
    console.error("deleteRound1Selection server error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const setRound1FirstChoice = async (req, res) => {
  try {
    const { taruf_id } = req.params;
    const { selector_id, first_choice } = req.body || {};
    if (!taruf_id || !selector_id) {
      return res.status(400).json({ success: false, error: "Missing params" });
    }

    const { data, error } = await Supabase.from("round1_selected")
      .update({ first_choice: first_choice ? String(first_choice) : null })
      .eq("taruf_id", Number(taruf_id))
      .eq("selector_registration_id", String(selector_id));

    if (error) {
      console.error("setRound1FirstChoice error:", error);
      return res.status(500).json({ success: false, error: "DB update error" });
    }

    return res.status(200).json({ success: true, updated: data?.length ?? 0 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const handleAutoAssign = async (req, res) => {
  const { taruf_id } = req.params;
  const roomCapacity = 10; // 10 // State to track assignments for conflict and capacity checks // Keys are dynamic slot IDs (1, 2, 3...)

  const slotState = {};
  let new_slot_entries = [];
  let processed_pairs = new Set(); // Tracks pairs already processed (forward or reverse)
  let max_assigned_slot = 0; // Helper to find the next valid slot for a pair (handles capacity and conflict)

  const findNextAvailableSlot = (selectorId, selectedId) => {
    let currentSlotId = 1;
    while (true) {
      // 1. Initialize slot state if it doesn't exist (DYNAMIC SLOT CREATION)
      if (!slotState[currentSlotId]) {
        slotState[currentSlotId] = {
          room_counter: 1, // Next room number to assign (1-10)
          assigned_participants: new Set(), // Participants booked in this slot
        };
      }

      const state = slotState[currentSlotId]; // 2. Check for Participant Conflict (double booking in the same slot)

      const hasConflict =
        state.assigned_participants.has(selectorId) ||
        state.assigned_participants.has(selectedId); // 3. Check for Room Capacity (If room_counter is 11, it means 10 rooms are already assigned)

      const isFull = state.room_counter > roomCapacity;

      if (!hasConflict && !isFull) {
        // Found an available slot that is not full and has no conflict
        return currentSlotId;
      } // If conflict or full, try the next slot

      currentSlotId++; // Safety break in case of excessive candidates/slots
      if (currentSlotId > 1000) return null;
    }
  };

  try {
    // 1. Fetch all round 1 selections
    const { data: all_rows, error: fetchError } = await Supabase.from(
      "round1_selected"
    )
      .select("*")
      .eq("taruf_id", taruf_id);

    if (fetchError)
      throw new Error(`Supabase fetch error: ${fetchError.message}`); // 2. Identify PM/FC pairs

    const pair_lookup = new Set(
      all_rows.map(
        (r) => `${r.selector_registration_id}|${r.selected_registration_id}`
      )
    );

    const all_assignable_rows = all_rows
      .map((row) => {
        // Perfect Match check
        const is_perfect = pair_lookup.has(
          `${row.selected_registration_id}|${row.selector_registration_id}`
        ); // First Choice check (Need type-safe comparison)
        const is_first =
          row.first_choice &&
          String(row.first_choice) === String(row.selected_its);

        return {
          ...row,
          is_perfect_match: is_perfect ? 1 : 0,
          is_first_choice: is_first ? 1 : 0,
        };
      })
      .filter((row) => row.is_perfect_match === 1 || row.is_first_choice === 1); // 3. Separate into priority queues (PMs get first choice of slots)

    const perfect_match_rows = all_assignable_rows.filter(
      (r) => r.is_perfect_match === 1
    );
    const first_choice_only_rows = all_assignable_rows.filter(
      (r) => r.is_perfect_match === 0 && r.is_first_choice === 1
    ); // 4. Assignment Logic

    const assignSlotEntry = (row, is_perfect, is_first_choice) => {
      const selectorId = row.selector_registration_id;
      const selectedId = row.selected_registration_id;
      const key_fwd = `${selectorId}|${selectedId}`;
      const key_rev = `${selectedId}|${selectorId}`; // Skip if this pair or its reverse is already processed

      if (processed_pairs.has(key_fwd) || processed_pairs.has(key_rev)) {
        return;
      }

      const assigned_slot_id = findNextAvailableSlot(selectorId, selectedId);

      if (assigned_slot_id) {
        const state = slotState[assigned_slot_id]; // Get and increment room number (e.g., if it's 3, use 3 then set to 4)

        const assigned_room_no = String(state.room_counter++); // Update state

        state.assigned_participants.add(selectorId);
        state.assigned_participants.add(selectedId);
        processed_pairs.add(key_fwd);
        max_assigned_slot = Math.max(max_assigned_slot, assigned_slot_id); // Create new slot entry with TBD timing

        new_slot_entries.push({
          taruf_id: row.taruf_id,
          selector_registration_id: selectorId,
          selected_registration_id: selectedId,
          candidate_its: row.selected_its,
          slot: assigned_slot_id,
          timings: "Wait to be Assign", // Placeholder for admin to set later
          room_no: assigned_room_no,
          is_perfect_match: is_perfect,
          is_first_choice: is_first_choice,
        });
      }
    }; // 5. Process assignments (ORDER MATTERS: PMs first, claiming prime slots) // Priority 1: Perfect Matches // They are assigned first, filling Slot 1 up to its capacity, then Slot 2, etc.

    for (const row of perfect_match_rows) {
      assignSlotEntry(row, 1, row.is_first_choice);
    } // Priority 2: First Choice Only Matches // The `findNextAvailableSlot` function (used inside `assignSlotEntry`) // ensures these pairs search starting from Slot 1 to fill any remaining gaps // left by PMs, **while still strictly checking for candidate conflicts**. // The ONLY reason a pair skips Slot 1 is the necessary conflict check or capacity being reached.

    for (const row of first_choice_only_rows) {
      assignSlotEntry(row, 0, 1);
    } // 6. Database Operations: Clear old auto-assigned data and insert new entries
    const { error: deleteError } = await Supabase.from("round1_slot")
      .delete()
      .eq("taruf_id", taruf_id) // Only delete previously auto-assigned (PM or FC) pairs
      .or("is_perfect_match.eq.1,is_first_choice.eq.1");
    if (deleteError) {
      console.warn("Supabase delete warning:", deleteError.message);
    }

    if (new_slot_entries.length > 0) {
      const { error: insertError } = await Supabase.from("round1_slot").insert(
        new_slot_entries
      );

      if (insertError)
        throw new Error(`Supabase insert error: ${insertError.message}`); // Return the key information needed by the admin

      return res.json({
        success: true,
        assigned_pairs: new_slot_entries.length,
        max_assigned_slot: max_assigned_slot, // How many slots the admin needs to define timings for
        message: `Successfully assigned ${new_slot_entries.length} pairs across ${max_assigned_slot} slots. Timings are set to 'TBD'.`,
      });
    } else {
      return res.json({
        success: true,
        assigned_pairs: 0,
        max_assigned_slot: 0,
        message: "No new pairs to assign based on current selections.",
      });
    }
  } catch (err) {
    console.error("handleAutoAssign error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
const updateRound1Timings = async (req, res) => {
  const { taruf_id } = req.params;
  const { timings } = req.body; // Expects an array: [{ slot: 1, timings: "09:00" }, ...]

  if (!taruf_id || !timings || !Array.isArray(timings)) {
    return res
      .status(400)
      .json({ success: false, error: "Missing taruf_id or timings data." });
  }

  try {
    let successfulUpdates = 0;
    let failedSlots = [];

    // Iterate through the array and update the timings for all rows matching the slot
    for (const { slot, timings: newTiming } of timings) {
      if (slot && newTiming) {
        // Supabase doesn't support batch updates based on multiple conditions directly,
        // so we update based on taruf_id and slot ID.
        const { error: updateError } = await Supabase.from("round1_slot")
          .update({ timings: newTiming })
          .eq("taruf_id", taruf_id)
          .eq("slot", slot);

        if (updateError) {
          console.error(`Error updating slot ${slot}:`, updateError);
          failedSlots.push(slot);
        } else {
          successfulUpdates++;
        }
      }
    }

    if (failedSlots.length > 0) {
      return res.status(500).json({
        success: false,
        error: `Successfully updated ${successfulUpdates} slots, but failed for slots: ${failedSlots.join(
          ", "
        )}.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully updated timings for ${successfulUpdates} slots.`,
    });
  } catch (err) {
    console.error("updateRound1Timings error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Server error during timing update." });
  }
};
/**
 * --- 2. CLEAR AUTO-ASSIGNMENTS FOR A SLOT ---
 *
 * DELETE /:taruf_id/round1_slots/auto?slot=:slotId
 *
 * Clears auto-assigned rows (perfect or first_choice) for a specific slot.
 */
const handleClearAutoSlots = async (req, res) => {
  const { taruf_id } = req.params;
  const { slot } = req.query; // slot = '1' or '2'

  if (!slot) {
    return res
      .status(400)
      .json({ success: false, error: "Slot query param is required." });
  }

  try {
    const { error, count } = await Supabase.from("round1_slot")
      .delete({ count: "exact" }) // 'exact' ensures 'count' is returned
      .eq("taruf_id", taruf_id)
      .eq("slot", parseInt(slot, 10))
      .or("is_perfect_match.eq.1,is_first_choice.eq.1"); // Only delete auto-assigned

    if (error) throw new Error(`Supabase delete error: ${error.message}`);

    return res.json({
      success: true,
      cleared_pairs: count, // For frontend alert
      deleted_slots: count, // For frontend alert
    });
  } catch (err) {
    console.error("handleClearAutoSlots error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Handles the manual update of slot and room number by performing a simple INSERT operation.
 * NOTE: This simplified version does NOT perform an UPSERT (update or insert).
 * If a unique record already exists, it will likely throw a database error.
 */
/**
 * Handles the manual update of slot and room number for an EXISTING record.
 * It uses the UPDATE method with a filter to target the specific candidate and round.
 */
const handleManualSlotUpdate = async (req, res) => {
  const {
    taruf_id,
    selector_registration_id,
    selected_registration_id,
    room_no,
    slot,
    candidate_its,
  } = req.body;

  // 1. Basic Validation
  // We need all three identifiers to uniquely target the row.
  if (!taruf_id || !selector_registration_id || !selected_registration_id) {
    return res.status(400).json({
      success: false,
      error:
        "Missing required identifiers (taruf_id, selector_registration_id, selected_registration_id) to find the record.",
    });
  }

  // 2. Prepare Data for Update
  // Only include the fields you intend to change (slot, room_no, and logging fields)
  const dataToUpdate = {
    // Convert empty string for room_no to null
    room_no: room_no === "" ? null : room_no,
    // Slot must be an integer (0 for unassigned or default)
    slot: parseInt(slot, 10) || 0,
    // Always update the timestamp
    updated_at: new Date().toISOString(),
    candidate_its: candidate_its,
  };

  try {
    // 3. Perform a targeted UPDATE operation.
    const { data, error } = await Supabase.from("round1_slot")
      .update(dataToUpdate)
      // The WHERE clause equivalent. We must match all three unique fields.
      .eq("taruf_id", parseInt(taruf_id, 10))
      .eq("selector_registration_id", selector_registration_id)
      .eq("selected_registration_id", selected_registration_id)
      .select() // Select the affected row(s)
      .limit(1);

    if (error) {
      console.error("Supabase UPDATE error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to update record in Supabase.",
      });
    }

    if (!data || data.length === 0) {
      // If no data is returned, it means no row matched the filter (the record doesn't exist yet).
      return res.status(404).json({
        success: false,
        error:
          "Record not found. No slot was updated. (Use INSERT if creating new record).",
      });
    }

    // 4. Return the updated record
    return res.json({
      success: true,
      message: "Slot and Room number updated successfully.",
      slot_entry: data[0],
    });
  } catch (error) {
    console.error("Server exception during slot/room update:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error.",
    });
  }
};
const handleCandidateSchedule = async (req, res) => {
  const { taruf_id, registration_id } = req.params;

  if (!taruf_id || !registration_id) {
    return res
      .status(400)
      .json({ success: false, error: "Missing taruf_id or registration_id" });
  }

  try {
    // 1. Fetch slots where the candidate is either selector OR selected
    const { data: slots, error: slotError } = await Supabase.from("round1_slot")
      .select("*")
      .eq("taruf_id", taruf_id)
      .or(
        `selector_registration_id.eq.${registration_id},selected_registration_id.eq.${registration_id}`
      );

    if (slotError) {
      console.error("handleCandidateSchedule slot error:", slotError);
      return res
        .status(500)
        .json({ success: false, error: "Database error fetching slots" });
    }

    if (!slots || slots.length === 0) {
      return res.status(200).json({ success: true, schedule: [] });
    }

    const assignedSchedule = [];

    // 2. Fetch all unique IDs for the other participants in the slots
    const participantIds = new Set();
    slots.forEach((slot) => {
      if (slot.selector_registration_id !== registration_id) {
        participantIds.add(slot.selector_registration_id);
      }
      if (slot.selected_registration_id !== registration_id) {
        participantIds.add(slot.selected_registration_id);
      }
    });
    // We assume there is a universal 'all_registered_candidates' view/table for profiles
    // Adjust 'all_registered_candidates' to your actual profile table name if needed.
    const { data: profiles, error: profileError } = await Supabase.from(
      "registrations"
    )
      .select("id, name, photo1Url, itsNumber, badgeNo")
      .order("badgeNo", { ascending: true })
      .in("id", Array.from(participantIds));

    if (profileError) {
      console.error("handleCandidateSchedule profile error:", profileError);
      return res
        .status(500)
        .json({ success: false, error: "Database error fetching profiles" });
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    // 3. Combine slot data with partner profile data
    slots.forEach((slot) => {
      // Determine the partner's ID
      const partnerId =
        slot.selector_registration_id === registration_id
          ? slot.selected_registration_id
          : slot.selector_registration_id;

      const partnerProfile =
        [...profileMap.values()].find(
          (p) => Number(p.id) === Number(partnerId)
        ) || null;

      assignedSchedule.push({
        slot: slot.slot,
        timings: slot.timings,
        room_no: slot.room_no,
        partner: partnerProfile,
        is_perfect_match: slot.is_perfect_match,
        is_first_choice: slot.is_first_choice,
      });
    });

    // Sort by slot number (e.g., Slot 1 then Slot 2)
    assignedSchedule.sort((a, b) => a.slot - b.slot);

    return res.status(200).json({ success: true, schedule: assignedSchedule });
  } catch (err) {
    console.error("handleCandidateSchedule exception:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const updateFirstChoice = async (req, res) => {
  const { taruf_id, selector_registration_id, selected_registration_id } =
    req.body;
  // selected_registration_id is the ID of the candidate that was clicked (the NEW one).

  if (!taruf_id || !selector_registration_id || !selected_registration_id) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields.",
    });
  }

  const newCandidateId = String(selected_registration_id);
  const supabase = Supabase;

  try {
    // --- 1. VALIDATION: Check if the NEW candidate is already slotted (slot > 0) ---
    // User requirement: check if the selected_registration_id is available.

    if (newCandidateId === "0") {
      // Based on frontend logic, "0" is used to clear, but the new requirement is replacement.
      // Let's assume the frontend won't send "0" in the final version.
      // If it does, we can stop here.
      throw new Error(
        "Clearing First Choice via radio button is not supported. Please select a candidate to replace the current one."
      );
    }

    // Check if the NEW candidate is already assigned a non-zero slot anywhere.
    const { data: bookedSlot, error: bookedError } = await supabase
      .from("round1_slot")
      .select("slot")
      .eq("taruf_id", taruf_id)
      .eq("selected_registration_id", newCandidateId)
      .gt("slot", 0) // Only check rows with an assigned slot
      .limit(1)
      .maybeSingle(); // Use maybeSingle() to handle 0 or 1 result robustly

    if (bookedError) throw new Error(bookedError.message);

    if (bookedSlot) {
      // Candidate is already assigned a slot
      // Returning 409 Conflict status is appropriate here.
      return res.status(409).json({
        success: false,
        error: `The selected candidate is already booked in Slot ${bookedSlot.slot}.`,
      });
    }

    // --- 2. FIND the CURRENT "First Choice" row (the row we will update) ---
    // This row contains the slot/room assignment for the selector's 'First Choice'.
    const { data: firstChoiceRow, error: findError } = await supabase
      .from("round1_slot")
      .select("id")
      .eq("taruf_id", taruf_id)
      .eq("selector_registration_id", selector_registration_id)
      .eq("is_first_choice", 1) // Crucially, find the row that currently holds the 'First Choice' flag
      .limit(1)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    if (!firstChoiceRow) {
      // This handles the scenario where the original error occurred (no existing first choice row).
      return res.status(404).json({
        success: false,
        error:
          "No existing 'First Choice' assignment found for this selector. Please ensure a candidate has been marked as First Choice or assigned a Slot/Room first.",
      });
    }

    // --- 3. UPDATE: Replace the candidate ID in the existing First Choice row ---
    const updatePayload = {
      selected_registration_id: newCandidateId, // Replace the candidate ID
      updated_at: new Date().toISOString(),
    };

    const { data: updatedData, error: updateError } = await supabase
      .from("round1_slot")
      .update(updatePayload)
      .eq("id", firstChoiceRow.id)
      .select()
      .maybeSingle(); // Use maybeSingle() to prevent the PGRST116 error, although update by PK should return 1 row.

    if (updateError) {
      console.error(
        "Supabase Update Error (First Choice Replace):",
        updateError
      );
      throw new Error(updateError.message);
    }

    // Return the updated row data
    return res.json({
      success: true,
      message: `First Choice candidate replaced with ID: ${newCandidateId}.`,
      slot_entry: updatedData,
    });
  } catch (error) {
    console.error("Error in updateFirstChoice:", error.message);
    return res.status(500).json({
      success: false,
      error: `Failed to update First Choice: ${error.message}`,
    });
  }
};

const getFeedbacks = async (req, res) => {
  // Use query parameters for GET request
  const { selectorIts, partnerIts } = req.query;
  if (!selectorIts || !partnerIts) {
    return res.status(400).json({
      success: false,
      error: "Missing ITS numbers for fetching feedback.",
    });
  }

  // 🚨 Define/Import your supabase client here if it's not global
  // const supabase = ...

  try {
    const { data, error } = await Supabase.from("feedback")
      .select("feedback")
      .eq("selectorIts", Number(selectorIts)) // Cast to Number
      .eq("partnerIts", Number(partnerIts)) // Cast to Number
      .limit(1);
    if (error) throw error;

    // Return the feedback text or null if not found
    const existingFeedback = data.length > 0 ? data[0].feedback : null;

    return res.status(200).json({
      success: true,
      feedback: existingFeedback,
    });
  } catch (err) {
    console.error("Server Error in getFeedback:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch feedback.",
    });
  }
};

const saveFeedback = async (req, res) => {
  // Destructure the required fields from the request body
  const { selectorIts, partnerIts, feedback, selectorName, partnerName } =
    req.body;

  // Basic validation
  if (!selectorIts || !partnerIts) {
    return res.status(400).json({
      success: false,
      error: "Missing selectorIts or partnerIts. Cannot save feedback.",
    });
  }

  try {
    const { data, error } = await Supabase.from("feedback")
      .upsert(
        {
          selector_its: String(selectorIts),
          partner_its: String(partnerIts),
          selector_name: selectorName,
          partner_name: partnerName,
          feedback: feedback,
        },
        { onConflict: "selector_its, partner_its" }
      )
      .select(); // Request the inserted/updated data back

    // ⚠️ CRITICAL FIX START ⚠️
    if (error) {
      // Log the error/warning for debugging, but don't treat it as a failure
      // if data was successfully returned (meaning the upsert worked).
      console.warn("Supabase Feedback Upsert warning/error:", error);

      if (!data || data.length === 0) {
        // If NO data was returned, THEN it's a true failure.
        // Throw a specific error to be caught by the catch block.
        throw new Error(error.message || "Failed to upsert data.");
      }
    }
    // ⚠️ CRITICAL FIX END ⚠️

    // Respond with success
    return res.status(200).json({
      success: true,
      message: "Feedback successfully auto-saved.",
      data: data,
    });
  } catch (err) {
    console.error("Server Error in saveFeedback:", err.message);
    // This is the error the frontend is currently receiving!
    return res.status(500).json({
      success: false,
      error: "Failed to save feedback due to a server error.",
    });
  }
};

// POST /api/ratings
// controllers/ratingsController.js (only the createRating function)
async function createRating(req, res) {
  try {
    let { selector_its, selector_name, partner_its, partner_name, rating } =
      req.body;

    // Basic presence checks
    if (
      !selector_its ||
      !partner_its ||
      typeof rating === "undefined" ||
      rating === null
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    // Normalize rating to lowercase string "yes" or "no"
    // if (typeof rating === "number") {
    //   // backward compatibility: treat nonzero as yes, zero as no
    //   rating = rating ? "yes" : "no";
    // } else {
    //   rating = String(rating).trim().toLowerCase();
    // }

    // if (!["yes", "no"].includes(rating)) {
    //   return res
    //     .status(400)
    //     .json({
    //       success: false,
    //       error: "Invalid rating. Allowed: 'yes' or 'no'.",
    //     });
    // }
    // await Supabase.from("ratings").delete().eq("selector_its", String(selector_its)).eq("partner_its", String(partner_its));
    // Upsert: If same selector_its + partner_its exists, update rating; otherwise insert new
    const { data, error } = await Supabase.from("ratings").insert([{
      selector_its: String(selector_its),
      selector_name: selector_name ?? null,
      partner_its: String(partner_its),
      partner_name: partner_name ?? null,
      rating: rating,
    }]);

    if (error) {
      console.error("supabase upsert error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.json({ success: true, data: data?.[0] ?? null });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Server error" });
  }
}

// GET /api/ratings?selectorIts=...&partnerIts=...
async function getSingleRating(req, res) {
  try {
    const selectorIts = String(req.query.selectorIts || "");
    const partnerIts = String(req.query.partnerIts || "");
    if (!selectorIts || !partnerIts) {
      return res.json({ success: true, rating: null });
    }
    const { data, error } = await Supabase
      .from("ratings")
      .select("rating")
      .eq("selector_its", selectorIts)
      .eq("partner_its", partnerIts)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.json({ success: true, rating: data?.rating ?? null });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Server error" });
  }
}

/**
 * GET /api/ratings/counsellor?name=CounsellorName
 * Returns ratings where either selector_its or partner_its belong to registrations that have counsellor = name.
 * Response: { success: true, ratings_given: [...], ratings_received: [...] }
 */
async function getRatingsForCounsellor(req, res) {
  try {
    const counsellorName = req.query.name;
    if (!counsellorName) {
      return res
        .status(400)
        .json({ success: false, error: "Missing counsellor name" });
    }

    // 1) get all registrations itsNumbers for this counsellor
    const { data: regs, error: regsErr } = await Supabase
      .from("registrations")
      .select("itsNumber, name, id, counsellor")
      .eq("counsellor", counsellorName);

    if (regsErr) {
      console.error("registrations query error:", regsErr);
      return res.status(500).json({ success: false, error: regsErr.message });
    }

    const itsList = (regs || [])
      .map((r) => String(r.itsNumber || r.its || "").trim())
      .filter(Boolean);
    if (itsList.length === 0) {
      return res.json({
        success: true,
        ratings_given: [],
        ratings_received: [],
      });
    }

    // 2) fetch ratings where selector_its in itsList (ratings given BY these candidates)
    const { data: given, error: givenErr } = await Supabase
      .from("ratings")
      .select("*")
      .in("selector_its", itsList).order("created_at", { ascending: false });

    if (givenErr) {
      console.error("ratings given query error:", givenErr);
      return res.status(500).json({ success: false, error: givenErr.message });
    }

    // 3) fetch ratings where partner_its in itsList (ratings received BY these candidates)
    const { data: received, error: recvErr } = await Supabase
      .from("ratings")
      .select("*")
      .in("partner_its", itsList);

    if (recvErr) {
      console.error("ratings received query error:", recvErr);
      return res.status(500).json({ success: false, error: recvErr.message });
    }

    return res.json({
      success: true,
      ratings_given: given || [],
      ratings_received: received || [],
      members_count: itsList.length,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Server error" });
  }
}

export {
  getActiveTarufs,
  checkRegistration,
  setPassword,
  candidateLogin,
  getRegistration,
  listRegistrations,
  getRegistrationById,
  submitRound1,
  getRegistrations,
  getRound1Selected,
  submitRound2,
  addRound1Selection,
  deleteRound1Selection,
  setRound1FirstChoice,
  handleAutoAssign,
  handleClearAutoSlots,
  handleManualSlotUpdate,
  handleCandidateSchedule,
  updateRound1Timings,
  updateFirstChoice,
  getFeedbacks,
  saveFeedback,
  createRating,
  getSingleRating,
  getRatingsForCounsellor,
};
