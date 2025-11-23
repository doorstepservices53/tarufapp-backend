import { Supabase } from "../db/db.js";

const Locations = async (req, res) => {
  try {
    const { data: locations, error: selectLocationError } = await Supabase.from(
      "locations"
    )
      .select("*")
      .neq("status", 2)
      .order("id", { ascending: true });

    if (selectLocationError) {
      console.error("Supabase select error:", selectLocationError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (req.method === "POST") {
      const { name } = req.body;
      // Basic validation
      if (!name) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields (location)",
        });
      }

      const row = {
        name,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await Supabase.from("locations")
        .insert([row])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      return res.status(201).json({ success: true, location: data });
    }

    // === EDIT / UPDATE handler (added) ===
    if (req.method === "PUT") {
      try {
        const { id, name } = req.body || {};

        // id required for update
        if (!id) {
          return res
            .status(400)
            .json({ success: false, error: "Missing location id" });
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

        const locationId = Number(id);
        const { data: updated, error: updateError } = await Supabase.from(
          "locations"
        )
          .update(updateRow)
          .eq("id", locationId)
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
            .json({ success: false, error: "Location not found" });
        }

        return res.status(200).json({ success: true, location: updated });
      } catch (err) {
        console.error("UpdateLocation error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    return res.status(200).json({
      success: true,
      valid: true,
      locations, // <-- send directly as array
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Locations };
