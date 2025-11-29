import { Supabase } from "../db/db.js";

const handleCandidateSchedule = async (req, res) => {
  const { taruf_id } = req.params;

  if (!taruf_id || !registration_id) {
    return res
      .status(400)
      .json({ success: false, error: "Missing taruf_id or registration_id" });
  }

  try {
    // 1. Fetch slots where the candidate is either selector OR selected
    const { data: slots, error: slotError } = await Supabase.from("round1_slot")
      .select("*")
      .eq("taruf_id", taruf_id);

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
      .select("id, name, photo1Url, itsNumber")
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

      const partnerProfile = profileMap.get(partnerId);

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

export { handleCandidateSchedule };
