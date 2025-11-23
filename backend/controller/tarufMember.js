// backend/controller/tarufMembers.js
import { Supabase } from "../db/db.js";

/**
 * addTarufMembers
 * POST /admin/taruf-members
 * body: { taruf_id: number, member_its: [bigint, ...] }
 */

export const fetchTarufMembers = async (req, res) => {
  try {
    let query = Supabase.from("taruf_members")
      .select("*")
      .order("id", { ascending: true });

    const { data: tarufMembers = [], error } = await query;

    if (error) {
      console.error("DB error fetching taruf_members:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    return res.status(200).json({ success: true, tarufMembers });
  } catch (err) {
    console.error("fetchTarufMembers error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const addTarufMembers = async (req, res) => {
  try {
    const { taruf_id, member_its } = req.body || {};
    const tId = Number(taruf_id);
    if (!tId || !Array.isArray(member_its) || member_its.length === 0) {
      return res.status(400).json({
        success: false,
        error: "taruf_id and member_its array are required",
      });
    }

    // normalize and dedupe
    const itsList = [
      ...new Set(member_its.map((i) => Number(i)).filter(Boolean)),
    ];
    if (!itsList.length)
      return res
        .status(400)
        .json({ success: false, error: "No valid ITS numbers provided" });

    // fetch existing for this taruf so we don't insert duplicates
    const { data: existing = [], error: existingErr } = await Supabase.from(
      "taruf_members"
    )
      .select("member_its")
      .eq("taruf_id", tId)
      .in("member_its", itsList);

    if (existingErr) {
      console.error("DB error fetching existing taruf_members:", existingErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    const existingSet = new Set(
      (existing || []).map((r) => Number(r.member_its))
    );
    const toInsert = itsList
      .filter((its) => !existingSet.has(its))
      .map((its) => ({ taruf_id: tId, member_its: its }));

    let inserted = [];
    if (toInsert.length) {
      const { data: insData = [], error: insertErr } = await Supabase.from(
        "taruf_members"
      )
        .insert(toInsert)
        .select("*");

      if (insertErr) {
        console.error("DB error inserting taruf_members:", insertErr);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      inserted = insData;
    }

    // fetch updated list of taruf_members for this taruf
    const { data: allTm = [], error: tmErr } = await Supabase.from(
      "taruf_members"
    )
      .select("*")
      .eq("taruf_id", tId);

    if (tmErr) {
      console.error("DB error fetching taruf_members after insert:", tmErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // fetch member info for ITS numbers we have
    const itsToFetch = [
      ...new Set(allTm.map((r) => Number(r.member_its)).filter(Boolean)),
    ];
    let members = [];
    if (itsToFetch.length) {
      const { data: membersData = [], error: membersErr } = await Supabase.from(
        "members"
      )
        .select("id, its_number, name")
        .in("its_number", itsToFetch);

      if (membersErr) {
        console.error("DB error fetching members:", membersErr);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      members = membersData;
    }

    const membersByIts = {};
    members.forEach((m) => {
      if (m) membersByIts[Number(m.its_number)] = m;
    });

    const membersList = allTm.map((tm) => {
      const its = Number(tm.member_its);
      const mm = membersByIts[its] || null;
      return {
        id: tm.id,
        member_its: its,
        member_id: mm?.id ?? null,
        name: mm?.name ?? null,
      };
    });

    return res
      .status(201)
      .json({ success: true, inserted, members: membersList });
  } catch (err) {
    console.error("addTarufMembers error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * deleteTarufMembers
 * DELETE /admin/taruf-members
 * body: { taruf_id, member_its: [its1, its2] }
 */
export const deleteTarufMembers = async (req, res) => {
  try {
    const { taruf_id, member_its } = req.body || {};
    const tId = Number(taruf_id);
    if (!tId || !Array.isArray(member_its) || member_its.length === 0) {
      return res.status(400).json({
        success: false,
        error: "taruf_id and member_its array are required",
      });
    }

    const itsList = [
      ...new Set(member_its.map((i) => Number(i)).filter(Boolean)),
    ];
    if (!itsList.length)
      return res
        .status(400)
        .json({ success: false, error: "No valid ITS numbers provided" });

    const { error: delErr } = await Supabase.from("taruf_members")
      .delete()
      .eq("taruf_id", tId)
      .in("member_its", itsList);

    if (delErr) {
      console.error("DB error deleting taruf_members:", delErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    // return updated members for this taruf
    const { data: allTm = [], error: tmErr } = await Supabase.from(
      "taruf_members"
    )
      .select("*")
      .eq("taruf_id", tId);

    if (tmErr) {
      console.error("DB error fetching taruf_members after delete:", tmErr);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    const itsToFetch = [
      ...new Set(allTm.map((r) => Number(r.member_its)).filter(Boolean)),
    ];
    let members = [];
    if (itsToFetch.length) {
      const { data: membersData = [], error: membersErr } = await Supabase.from(
        "members"
      )
        .select("id, its_number, name")
        .in("its_number", itsToFetch);

      if (membersErr) {
        console.error("DB error fetching members:", membersErr);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }
      members = membersData;
    }

    const membersByIts = {};
    members.forEach((m) => {
      if (m) membersByIts[Number(m.its_number)] = m;
    });

    const membersList = allTm.map((tm) => {
      const its = Number(tm.member_its);
      const mm = membersByIts[its] || null;
      return {
        id: tm.id,
        member_its: its,
        member_id: mm?.id ?? null,
        name: mm?.name ?? null,
      };
    });

    return res.status(200).json({ success: true, members: membersList });
  } catch (err) {
    console.error("deleteTarufMembers error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * deleteTarufMemberById
 * DELETE /admin/taruf-members/:id
 */
export const deleteTarufMemberById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id)
      return res.status(400).json({ success: false, error: "Invalid id" });

    const { data: deleted = [], error } = await Supabase.from("taruf_members")
      .delete()
      .eq("id", id)
      .select("*");

    if (error) {
      console.error("DB error deleting taruf_member by id:", error);
      return res.status(500).json({ success: false, error: "Database error" });
    }
    return res.status(200).json({ success: true, deleted });
  } catch (err) {
    console.error("deleteTarufMemberById error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export default {
  addTarufMembers,
  deleteTarufMembers,
  deleteTarufMemberById,
};
