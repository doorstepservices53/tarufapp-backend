import { Supabase } from "../db/db.js";
import dayjs from "dayjs";

const Candidates = async (req, res) => {
  try {
    const { data: candidates, error: selectCandidateError } =
      await Supabase.from("candidates")
        .select("*")
        .neq("status", 2)
        .order("id", { ascending: true });

    if (selectCandidateError) {
      console.error("Supabase select error:", selectCandidateError);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // === EDIT / UPDATE handler (added) ===
    if (req.method === "PUT") {
      try {
        const {
          id,
          its_number,
          title,
          name,
          watan,
          contact,
          whatsapp,
          address,
          candidatecity,
          parentscity,
          state,
          pincode,
          country,
          nationality,
          email,
          currenteducation,
          schoolname,
          collegename,
          degree,
          hobbies,
          remarks,
          fathername,
          mothername,
          // dob,
          age,
          height,
          weight,
          maritalstatus,
          gender,
          occupation,
          weightunit,
          counsellor,
          siblings,
          spousepreference,
          lifegoals,
        } = req.body || {};

        // id required for update
        if (!id) {
          return res
            .status(400)
            .json({ success: false, error: "Missing candidate id" });
        }

        // Basic validation (same as create)
        if (
          (!its_number,
          !name,
          !watan,
          !contact,
          !whatsapp,
          !candidatecity,
          !parentscity,
          !state,
          !pincode,
          !country,
          !nationality,
          !age,
          !gender,
          !counsellor,
          !spousepreference)
        ) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields",
          });
        }

        const updateRow = {
          its_number: its_number,
          title: title,
          name: name,
          age: age,
          watan: watan,
          contact: contact,
          whatsapp: whatsapp,
          address: address,
          candidatecity: candidatecity,
          parentscity: parentscity,
          state: state,
          pincode: pincode,
          country: country,
          nationality: nationality,
          email: email,
          currenteducation: currenteducation,
          schoolname: schoolname,
          collegename: collegename,
          degree: degree,
          hobbies: hobbies,
          remarks: remarks,
          fathername: fathername,
          mothername: mothername,
          // dob: dob,
          height: height,
          weight: weight,
          maritalstatus: maritalstatus,
          gender: gender,
          occupation: occupation,
          weightunit: weightunit,
          counsellor: counsellor,
          siblings: siblings,
          spousepreference: spousepreference,
          lifegoals: lifegoals,
          updated_at: new Date().toISOString(),
        };

        const candidateId = Number(id);
        const { data: updated, error: updateError } = await Supabase.from(
          "candidates"
        )
          .update(updateRow)
          .eq("id", candidateId)
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
            .json({ success: false, error: "Candidate not found" });
        }

        return res.status(200).json({ success: true, candidate: updated });
      } catch (err) {
        console.error("UpdateCandidate error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    // === CREATE existing handler (unchanged) ===
    if (req.method === "POST") {
      try {
        const {
          its_number,
          title,
          name,
          watan,
          contact,
          whatsapp,
          address,
          candidatecity,
          parentscity,
          state,
          pincode,
          country,
          nationality,
          email,
          age,
          currenteducation,
          schoolname,
          collegename,
          degree,
          hobbies,
          remarks,
          fathername,
          mothername,
          // dob,
          height,
          weight,
          maritalstatus,
          gender,
          occupation,
          weightunit,
          counsellor,
          siblings,
          spousepreference,
          lifegoals,
        } = req.body;

        // Basic validation
        if (
          (!its_number,
          !name,
          !watan,
          !contact,
          !whatsapp,
          !candidatecity,
          !parentscity,
          !state,
          !pincode,
          !country,
          !nationality,
          // !dob,
          !gender,
          !counsellor,
          !spousepreference)
        ) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields",
          });
        }

        const row = {
          its_number,
          title,
          name,
          age: age,
          watan,
          contact,
          whatsapp,
          address,
          candidatecity,
          parentscity,
          state,
          pincode,
          country,
          nationality,
          email,
          currenteducation,
          schoolname,
          collegename,
          degree,
          hobbies,
          remarks,
          fathername,
          mothername,
          // dob,
          height,
          weight,
          maritalstatus,
          gender,
          occupation,
          weightunit,
          counsellor,
          siblings,
          spousepreference,
          lifegoals,
          is_atb: 1,
          status: 1, // convention from your app (active)
          created_at: new Date().toISOString(),
        };

        const { data, error } = await Supabase.from("candidates")
          .insert([row])
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }

        return res.status(201).json({ success: true, candidate: data });
      } catch (err) {
        console.error("createCandidate error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    // Default: return candidates list (unchanged)
    return res.status(200).json({
      success: true,
      valid: true,
      candidates, // <-- send directly as array
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Candidates };
