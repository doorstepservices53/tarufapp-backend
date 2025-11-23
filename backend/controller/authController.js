// controllers/auth.js
import { Supabase } from "../db/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, error: "Missing email or password" });

    const { data: user, error: selectError } = await Supabase.from("admins")
      .select("id, name, email, password, role, status")
      .eq("email", email)
      .maybeSingle();

    if (selectError) {
      console.error("Supabase select error:", selectError);
      return res
        .status(500)
        .json({ success: false, error: "Database or Network error" });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: "User Not Found" });
    }

    const isMatched = await bcrypt.compare(password, user.password);
    if (!isMatched) {
      return res
        .status(401)
        .json({ success: false, error: "Entered Password Is Incorrect" });
    }

    const token = jwt.sign(
      { _id: user.id, role: user.role || "admin" },
      process.env.JWT_KEY,
      {
        expiresIn: "10d",
      }
    );

    return res.status(200).json({
      success: true,
      token,
      user: { _id: user.id, name: user.name, role: user.role || "admin" },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const verifyLogin = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, valid: false, error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_KEY);
    } catch (err) {
      if (err.name === "TokenExpiredError")
        return res
          .status(401)
          .json({ success: false, valid: false, error: "Token expired" });
      return res
        .status(401)
        .json({ success: false, valid: false, error: "Invalid token" });
    }

    const userId = decoded._id || decoded.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, valid: false, error: "Invalid token payload" });
    }

    const { data: user, error: selectError } = await Supabase.from("admins")
      .select("id, name, email, role")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      console.error("Supabase select error:", selectError);
      return res
        .status(500)
        .json({ success: false, valid: false, error: "Database error" });
    }

    if (!user) {
      return res
        .status(404)
        .json({ success: false, valid: false, error: "User not found" });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      user: { _id: user.id, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("verifyLogin error:", err);
    return res
      .status(500)
      .json({ success: false, valid: false, error: "Server error" });
  }
};

const MemberLogin = async (req, res) => {
  try {
    const { its, password } = req.body;
    if (!its || !password)
      return res
        .status(400)
        .json({ success: false, error: "Missing ITS or Password" });

    const { data: user, error: selectError } = await Supabase.from("members")
      .select(
        "id, its_number, name, contact, email, password, designation_id, location_id, status"
      )
      .eq("its_number", its)
      .maybeSingle();

    if (selectError) {
      console.error("Supabase select error:", selectError);
      return res
        .status(500)
        .json({ success: false, error: "Database or Network error" });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: "User Not Found" });
    }

    // compare plaintext password from frontend with hashed password from DB
    const isMatched = await bcrypt.compare(password, user.password);
    if (!isMatched) {
      return res
        .status(401)
        .json({ success: false, error: "Entered Password Is Incorrect" });
    }

    // create JWT with role explicitly set to 'member'
    const token = jwt.sign(
      { _id: user.id, role: "member" },
      process.env.JWT_KEY,
      {
        expiresIn: "10d",
      }
    );

    // Try to find matching taruf_id from taruf_members by its_number
    let tarufId = null;
    try {
      if (user.its_number) {
        // get the most recent matching record (adjust ordering if you prefer first)
        const { data: tmRows, error: tmError } = await Supabase.from(
          "taruf_members"
        )
          .select("taruf_id")
          .eq("member_its", user.its_number)
          .order("id", { ascending: false });

        if (tmError) {
          console.error("Supabase select error (taruf_members):", tmError);
          // non-fatal: continue without tarufId
        } else if (Array.isArray(tmRows) && tmRows.length > 0) {
          tarufId = tmRows[0].taruf_id ?? null;
        }
      }
    } catch (innerErr) {
      console.error("Error checking taruf_members:", innerErr);
      // continue — tarufId remains null
    }

    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user.id,
        name: user.name,
        its_number: user.its_number,
        taruf_id: tarufId,
        role: "member",
      },
    });
  } catch (error) {
    console.error("MemberLogin error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

const verifyMemberLogin = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, valid: false, error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_KEY);
    } catch (err) {
      if (err.name === "TokenExpiredError")
        return res
          .status(401)
          .json({ success: false, valid: false, error: "Token expired" });
      return res
        .status(401)
        .json({ success: false, valid: false, error: "Invalid token" });
    }

    const userId = decoded._id || decoded.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, valid: false, error: "Invalid token payload" });
    }

    // fetch user by id (select only safe fields)
    const { data: user, error: selectError } = await Supabase.from("members")
      .select("id, name, email, its_number")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      console.error("Supabase select error (members):", selectError);
      return res
        .status(500)
        .json({ success: false, valid: false, error: "Database error" });
    }

    if (!user) {
      return res
        .status(404)
        .json({ success: false, valid: false, error: "User not found" });
    }

    // Default role for this endpoint
    const role = "member";

    // Try to find matching taruf_id from taruf_members by its_number
    let tarufId = null;
    try {
      if (user.its_number) {
        // get the most recent matching record (adjust ordering if you prefer first)
        const { data: tmRows, error: tmError } = await Supabase.from(
          "taruf_members"
        )
          .select("taruf_id")
          .eq("member_its", user.its_number)
          .order("id", { ascending: false });

        if (tmError) {
          console.error("Supabase select error (taruf_members):", tmError);
          // non-fatal: continue without tarufId
        } else if (Array.isArray(tmRows) && tmRows.length > 0) {
          tarufId = tmRows[0].taruf_id ?? null;
        }
      }
    } catch (innerErr) {
      console.error("Error checking taruf_members:", innerErr);
      // continue — tarufId remains null
    }

    return res.status(200).json({
      success: true,
      valid: true,
      user: {
        _id: user.id,
        name: user.name,
        its_number: user.its_number,
        taruf_id: tarufId,
        role,
      },
    });
  } catch (err) {
    console.error("verifyMemberLogin error:", err);
    return res
      .status(500)
      .json({ success: false, valid: false, error: "Server error" });
  }
};

export { Login, MemberLogin, verifyLogin, verifyMemberLogin };
