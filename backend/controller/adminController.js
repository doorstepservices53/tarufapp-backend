import { Supabase } from "../db/db.js";
import bcrypt from "bcrypt";

const Admins = async (req, res) => {
  try {
    // GET: fetch admins
    if (req.method === "GET") {
      const { data: admins, error: selectAdminError } = await Supabase.from(
        "admins"
      )
        .select("*")
        .neq("status", 2)
        .order("id", { ascending: true });

      if (selectAdminError) {
        console.error("Supabase select error:", selectAdminError);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      return res.status(200).json({ success: true, valid: true, admins });
    }

    // POST: create admin
    if (req.method === "POST") {
      const { name, contact, email, password } = req.body || {};

      // proper validation
      if (!name || !contact || !email || !password) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: name, contact, email, password",
        });
      }

      // optional: ensure email uniqueness before insert
      const { data: existingByEmail, error: emailCheckError } =
        await Supabase.from("admins")
          .select("id")
          .eq("email", email)
          .maybeSingle();

      if (emailCheckError) {
        console.error("Email lookup error:", emailCheckError);
        // not fatal for user - continue or return 500
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      if (existingByEmail) {
        return res.status(409).json({
          success: false,
          error: "Email already in use",
          details: `admin with id=${existingByEmail.id} uses this email`,
        });
      }

      const hashPassword = await bcrypt.hash(password, 10);

      const row = {
        name,
        contact,
        email,
        password: hashPassword,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await Supabase.from("admins")
        .insert([row])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        // handle duplicate-key explicitly
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,
            error: "Conflict - duplicate key",
            details: error.details || error.message,
          });
        }
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      return res.status(201).json({ success: true, admin: data });
    }

    // PUT: update admin
    if (req.method === "PUT") {
      const { id, name, contact, email } = req.body || {};

      if (!id) {
        return res.status(400).json({ success: false, error: "Missing ID" });
      }
      if (!name || !contact || !email) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields for update: name, contact, email",
        });
      }

      const updateRow = {
        name,
        contact,
        email,
        updated_at: new Date().toISOString(),
      };

      const adminId = Number(id);
      const { data: updated, error: updateError } = await Supabase.from(
        "admins"
      )
        .update(updateRow)
        .eq("id", adminId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("Supabase update error:", updateError);
        if (updateError.code === "23505") {
          return res.status(409).json({
            success: false,
            error: "Conflict - duplicate key during update",
            details: updateError.details || updateError.message,
          });
        }
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      if (!updated) {
        return res
          .status(404)
          .json({ success: false, error: "Admin not found" });
      }

      return res.status(200).json({ success: true, admin: updated });
    }

    // method not allowed
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  } catch (err) {
    console.error("Admins handler error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Admins };
