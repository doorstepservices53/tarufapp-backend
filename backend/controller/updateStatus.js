import { Supabase } from "../db/db.js";

const UpdateStatus = async (req, res) => {
  try {
    const { status, id, table } = req.body;
    const { data, error } = await Supabase.from(table)
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    return res.status(200).json({ success: true, meeting: data });
  } catch (err) {
    console.error("UpdateStatus error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { UpdateStatus };
