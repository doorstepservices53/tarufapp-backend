// userSeed.js
import { Supabase } from "./db/db.js"; // you export `Supabase` from db/db.js
import bcrypt from "bcrypt";

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_NAME = "admin";
const ADMIN_PASSWORD = "admin"; // you can prompt or read from env for safety
const ADMIN_ROLE = "admin";
const ADMIN_CONTACT = "8619125780";

async function userRegister() {
  try {
    // check existing user by email
    const { data: existing, error: selectError } = await Supabase.from("admins")
      .select("id, email")
      .eq("email", ADMIN_EMAIL)
      .limit(1);

    if (selectError) throw selectError;

    if (existing && existing.length > 0) {
      console.log("Admin user already exists:", existing[0].email);
      process.exit(0);
    }

    // hash password
    const hashPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // insert new admin
    const { data, error: insertError } = await Supabase.from("admins")
      .insert([
        {
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          contact: ADMIN_CONTACT,
          password: hashPassword,
          role: ADMIN_ROLE,
          status: 1,
        },
      ])
      .select(); // return inserted row(s)

    if (insertError) throw insertError;

    console.log("Admin created:");
    process.exit(0);
  } catch (err) {
    console.error("Failed to create admin:", err);
    process.exit(1);
  }
}

userRegister();
