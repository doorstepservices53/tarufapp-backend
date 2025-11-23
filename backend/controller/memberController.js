import { Supabase } from "../db/db.js";
import bcrypt from "bcrypt";

const Members = async (req, res) => {
  try {
    const { data: members, error: selectMemberError } = await Supabase.from(
      "members"
    )
      .select("*")
      .neq("status", 2)
      .order("id", { ascending: true });

    if (selectMemberError) {
      console.error("Supabase select error:", selectMemberError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // === EDIT / UPDATE handler (added) ===
    if (req.method === "PUT") {
      try {
        const {
          id,
          its_number,
          name,
          contact,
          email,
          designation_id,
          location_id,
        } = req.body || {};

        // id required for update
        if (!id) {
          return res
            .status(400)
            .json({ success: false, error: "Missing member id" });
        }

        // Basic validation (same as create)
        if (
          (!its_number, !name, !contact, !email, !designation_id, !location_id)
        ) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields",
          });
        }
        const updateRow = {
          its_number: its_number,
          name: name,
          contact: contact,
          email: email,
          designation_id: designation_id,
          location_id: location_id,
          updated_at: new Date().toISOString(),
        };

        const memberId = Number(id);
        const { data: updated, error: updateError } = await Supabase.from(
          "members"
        )
          .update(updateRow)
          .eq("id", memberId)
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
            .json({ success: false, error: "Member not found" });
        }

        return res.status(200).json({ success: true, member: updated });
      } catch (err) {
        console.error("UpdateMember error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    // === CREATE existing handler (unchanged) ===
    if (req.method === "POST") {
      try {
        const {
          its_number,
          name,
          contact,
          email,
          password,
          designation_id,
          location_id,
        } = req.body;

        // Basic validation
        if (
          (!its_number,
          !name,
          !contact,
          !email,
          !password,
          !designation_id,
          !location_id)
        ) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields",
          });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        const row = {
          its_number,
          name,
          contact,
          email,
          password: hashPassword,
          designation_id,
          location_id,
          status: 1, // convention from your app (active)
          created_at: new Date().toISOString(),
        };

        const { data, error } = await Supabase.from("members")
          .insert([row])
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }

        return res.status(201).json({ success: true, member: data });
      } catch (err) {
        console.error("createMember error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    // Default: return members list (unchanged)
    return res.status(200).json({
      success: true,
      valid: true,
      members, // <-- send directly as array
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Members };
