import { Supabase } from "../db/db.js";

const DeleteBtn = async (req, res) => {
  try {
    const { id, table } = req.body;

    const { data, error } = await Supabase.from(table)
      .delete()
      .eq("id", id)
      .select(); // 👈 return deleted row(s)

    if (error) {
      console.error("Supabase delete error:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: `${table} not found` });
    }

    return res
      .status(200)
      .json({ success: true, message: `${table} deleted successfully` });
  } catch (err) {
    console.error("DeleteMeeting error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { DeleteBtn };
