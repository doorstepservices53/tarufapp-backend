// controller/tarufRegisters.js
import { Supabase } from "../db/db.js";

// ✅ GET all registrations for a specific taruf
export const TarufRegisters = async (req, res) => {
  try {
    const { taruf_id } = req.query;
    if (!taruf_id) {
      return res
        .status(400)
        .json({ success: false, message: "Missing taruf_id in query" });
    }

    // Query Supabase for all registrations of that taruf
    const { data, error } = await Supabase.from("registrations")
      .select("*")
      .eq("taruf_id", taruf_id)
      .order("invitationSentDate", { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Error in TarufRegisters:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ GET single registration detail by ID
export const TarufRegistersByIds = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await Supabase.from("registrations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found" });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Error in TarufRegistersByIds:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
