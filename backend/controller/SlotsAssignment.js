import { Supabase } from "../db/db.js";
/**
 * Fetches all slot assignments for all Tarufs by performing a manual join in the backend.
 * This approach avoids the PostgREST relationship error.
 * Route: GET /admin/round1_slots
 */
export const getAllRound1Slots = async (req, res) => {
  try {
    // --- STEP 1: Fetch all slot data (unjoined) ---
    // We select all columns, including the Foreign Key IDs.
    const { data: slots, error: slotsError } = await Supabase.from(
      "round1_slot"
    ).select(`*`);

    if (slotsError) throw new Error(slotsError.message);
    if (!slots || slots.length === 0) {
      return res.status(200).json({ slots: [] });
    }

    // --- STEP 2: Gather all unique registration IDs needed ---
    const selectorIds = slots
      .map((s) => s.selector_registration_id)
      .filter(Boolean);
    const selectedIds = slots
      .map((s) => s.selected_registration_id)
      .filter(Boolean);
    // Create a unique list of all IDs needed for lookup
    const allIds = [...new Set([...selectorIds, ...selectedIds])];

    // --- STEP 3: Fetch all required registration details in one go ---
    let registrationMap = {};
    if (allIds.length > 0) {
      const { data: registrations, error: regError } = await Supabase.from(
        "registrations"
      )
        .select("id, itsNumber, name")
        // Use the IN filter to fetch all necessary registrations at once
        .in("id", allIds);

      if (regError) throw new Error(regError.message);

      // Create a quick lookup map: { registration_id: { details... } }
      registrations.forEach((r) => {
        registrationMap[r.id] = {
          itsNumber: r.itsNumber,
          name: r.name,
          // last_name: r.lastName,
        };
      });
    }

    // --- STEP 4: Merge Data and Format ---
    const formattedSlots = slots.map((slot) => {
      // Lookup selector and selected details from the map
      const selector = registrationMap[slot.selector_registration_id] || {};
      const selected = registrationMap[slot.selected_registration_id] || {};

      return {
        id: slot.id,
        tarufId: slot.taruf_id,
        slot: slot.slot,
        timings: slot.timings,
        roomNo: slot.room_no,
        adminNote: slot.admin_note,

        // Safety check for boolean conversion
        isPerfectMatch: !!slot.is_perfect_match,
        isFirstChoice: !!slot.is_first_choice,

        // Selector Details
        selectorITS: selector.itsNumber || "N/A",
        selectorName: `${selector.first_name || ""} ${
          selector.last_name || ""
        }`.trim(),

        // Selected Candidate Details
        selectedITS: selected.itsNumber || "N/A",
        selectedName: `${selected.first_name || ""} ${
          selected.last_name || ""
        }`.trim(),
      };
    });

    res.status(200).json({ slots: formattedSlots });
  } catch (err) {
    console.error(`Error in getAllRound1Slots: ${err.message}`, err.stack);
    res.status(500).json({
      error: "Error fetching admin slot data.",
      detail: err.message,
    });
  }
};
