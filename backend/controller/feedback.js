import { Supabase } from "../db/db.js";

// server/controllers/feedback.js (or wherever you define getFeedback)

const getFeedback = async (req, res) => {
  try {
    // Read query params (GET /feedback?partnerIts=...&selectorIts=...)
    const partnerIts = Number(req.query.partnerIts || req.body?.partnerIts);
    const selectorIts = Number(req.query.selectorIts || req.body?.selectorIts);

    if (!partnerIts) {
      return res.status(400).json({ error: "partnerIts is required" });
    }

    // Start building the query
    let query = Supabase.from("feedback")
      .select("*")
      .eq("partnerIts", partnerIts);

    // If caller passed selectorIts, apply it as an additional filter (optional)
    if (selectorIts) {
      query = query.eq("selectorIts", selectorIts);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase select error:", error);
      return res
        .status(500)
        .json({ error: "Database read failed", details: error });
    }

    return res.status(200).json({ feedback: data || [] });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching feedback" });
  }
};

const submitFeedback = async (req, res) => {
  try {
    const { selectorIts, partnerIts, selectorName, partnerName, feedback } =
      req.body;
    await Supabase.from("feedback").delete().eq("selectorIts", selectorIts).eq("partnerIts", partnerIts);
    await Supabase.from("feedback").insert([
      {
        selectorIts,
        selectorName,
        partnerIts,
        partnerName,
        feedback: feedback,
      },
    ]);
    res.status(200).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res
      .status(500)
      .json({ error: "An error occurred while submitting feedback" });
  }
};

const getAllCandidatesWithFeedback = async (req, res) => {
  try {
    // Fetch all feedback rows, newest first per created_at, and ordered by partnerIts
    const { data, error } = await Supabase.from("feedback")
      .select("*")
      .order("partnerIts", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase select error:", error);
      return res
        .status(500)
        .json({ error: "Database read failed", details: error });
    }

    // Group by partnerIts
    const grouped = data.reduce((acc, row) => {
      const key = String(row.partnerIts ?? row.partner_its ?? "unknown");
      if (!acc[key]) {
        acc[key] = {
          partnerIts: row.partnerIts ?? row.partner_its ?? null,
          partnerName: row.partnerName ?? row.partner_name ?? null,
          feedbacks: [],
        };
      }
      acc[key].feedbacks.push({
        id: row.id,
        selectorIts: row.selectorIts ?? row.selector_its ?? null,
        selectorName: row.selectorName ?? row.selector_name ?? null,
        memberName: row.memberName ?? row.member_name ?? null,
        memberIts: row.memberIts ?? row.member_its ?? null,
        feedback: row.feedback,
        created_at: row.created_at,
      });
      return acc;
    }, {});

    const result = Object.values(grouped);

    return res.status(200).json({ candidates: result });
  } catch (err) {
    console.error("getAllCandidatesWithFeedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /members-feedback
 * Body: { memberIts, candidateIts, memberFeedback }
 * Insert a new feedback row mapping to your schema
 */
const submitMemberFeedback = async (req, res) => {
  try {
    const { memberIts, candidateIts, memberFeedback, memberName } = req.body;

    if (!candidateIts || typeof memberFeedback === "undefined") {
      return res
        .status(400)
        .json({ error: "candidateIts and memberFeedback are required" });
    }

    // Allow memberIts to be optional (if you want anonymous feedback). If required, validate earlier.
    const insertObj = {
      memberIts: memberIts ?? null,
      memberName: memberName ?? null,
      partnerIts: candidateIts,
      feedback: memberFeedback,
    };

    const { data, error } = await Supabase.from("feedback").insert([insertObj]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res
        .status(500)
        .json({ error: "Database insert failed", details: error });
    }

    // Return the inserted row(s)
    return res
      .status(200)
      .json({ message: "Review submitted", inserted: data });
  } catch (err) {
    console.error("submitMemberFeedback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export {
  submitFeedback,
  getFeedback,
  getAllCandidatesWithFeedback,
  submitMemberFeedback,
};
