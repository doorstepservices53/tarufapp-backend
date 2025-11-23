import { Supabase } from "../db/db.js";

const Designations = async (req, res) => {
  try {
    const { data: designations, error: selectDesignationError } =
      await Supabase.from("designations")
        .select("*")
        .neq("status", 2)
        .order("id", { ascending: true });

    if (selectDesignationError) {
      console.error("Supabase select error:", selectDesignationError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (req.method === "POST") {
      const { name } = req.body;
      // Basic validation
      if (!name) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields (designation)",
        });
      }

      const row = {
        name,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await Supabase.from("designations")
        .insert([row])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      return res.status(201).json({ success: true, designation: data });
    }

    // === EDIT / UPDATE handler (added) ===
    if (req.method === "PUT") {
      try {
        const { id, name } = req.body || {};

        // id required for update
        if (!id) {
          return res
            .status(400)
            .json({ success: false, error: "Missing designation id" });
        }

        // Basic validation (same as create)
        if (!name) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields (name)",
          });
        }

        const updateRow = {
          name,
          updated_at: new Date().toISOString(),
        };

        const designationId = Number(id);
        const { data: updated, error: updateError } = await Supabase.from(
          "designations"
        )
          .update(updateRow)
          .eq("id", designationId)
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
            .json({ success: false, error: "Designation not found" });
        }

        return res.status(200).json({ success: true, designation: updated });
      } catch (err) {
        console.error("UpdateDesignation error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    return res.status(200).json({
      success: true,
      valid: true,
      designations, // <-- send directly as array
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Designations };
