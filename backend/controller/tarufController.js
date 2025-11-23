// controllers/tarufs.js
import { Supabase } from "../db/db.js";

// ... keep other helpers and POST/PUT/DELETE code as before ...

const Tarufs = async (req, res) => {
  try {
    // === GET: list tarufs with timings AND members ===
    if (req.method === "GET") {
      // fetch tarufs + timings as before
      const { data: tarufs = [], error: tarufErr } = await Supabase.from(
        "tarufs"
      )
        .select("*, timings(*)")
        .neq("status", 2)
        .order("created_at", { ascending: false });

      if (tarufErr) {
        console.error("Supabase select error (tarufs):", tarufErr);
        return res
          .status(500)
          .json({ success: false, error: "Database error" });
      }

      // collect taruf ids
      const tarufIds = [
        ...new Set((tarufs || []).map((t) => t.id).filter(Boolean)),
      ];
      let tarufMembers = [];
      if (tarufIds.length) {
        const { data: tmData = [], error: tmErr } = await Supabase.from(
          "taruf_members"
        )
          .select("*")
          .in("taruf_id", tarufIds);

        if (tmErr) {
          console.error("Supabase select error (taruf_members):", tmErr);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }
        tarufMembers = tmData; // rows with id, member_its, taruf_id
      }

      // collect member_its values to fetch member names
      const memberItsList = [
        ...new Set(
          (tarufMembers || []).map((m) => m.member_its).filter(Boolean)
        ),
      ];

      let members = [];
      if (memberItsList.length) {
        const { data: membersData = [], error: membersErr } =
          await Supabase.from("members")
            .select("id, its_number, name")
            .in("its_number", memberItsList);

        if (membersErr) {
          console.error("Supabase select error (members):", membersErr);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }
        members = membersData;
      }

      // build mapping its_number -> member object
      const membersByIts = {};
      members.forEach((m) => {
        if (m && m.its_number !== undefined)
          membersByIts[Number(m.its_number)] = m;
      });

      // build mapping taruf_id -> members array (include taruf_members.id so we can delete by id)
      const tarufMembersMap = {};
      tarufMembers.forEach((tm) => {
        if (!tm || !tm.taruf_id) return;
        const arr = tarufMembersMap[Number(tm.taruf_id)] || [];
        const its = Number(tm.member_its);
        const memberRow = membersByIts[its] || null;
        arr.push({
          id: tm.id, // taruf_members id
          member_its: its,
          member_id: memberRow?.id ?? null, // members.id if available
          name: memberRow?.name ?? null,
        });
        tarufMembersMap[Number(tm.taruf_id)] = arr;
      });

      // attach members array to each taruf
      const tarufsWithMembers = (tarufs || []).map((t) => ({
        ...t,
        members: tarufMembersMap[Number(t.id)] || [],
      }));

      return res.status(200).json({ success: true, tarufs: tarufsWithMembers });
    }

    // inside controllers/tarufs.js — put before the catch block for Tarufs
    // Assumes Supabase import already exists at top: import { Supabase } from "../db/db.js";

    // === POST: create a new taruf (with optional timings) ===
    if (req.method === "POST") {
      try {
        const { name, location_id, timings = [] } = req.body || {};

        if (!name) {
          return res
            .status(400)
            .json({ success: false, error: "Missing name" });
        }

        const newRow = {
          name,
          location_id: location_id ?? null,

          status: 1,
          created_at: new Date().toISOString(),
        };

        const { data: created, error: insertErr } = await Supabase.from(
          "tarufs"
        )
          .insert([newRow])
          .select()
          .single();

        if (insertErr) {
          console.error("Supabase insert taruf error:", insertErr);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }

        const tarufId = created.id;

        // insert timings if provided (map to DB column names)
        if (Array.isArray(timings) && timings.length > 0) {
          const timingRows = timings.map((t) => ({
            taruf_id: tarufId,
            date: t.date ?? null,
            start_time: t.start_time ?? t.startTime ?? null,
            end_time: t.end_time ?? t.endTime ?? null,
            created_at: new Date().toISOString(),
          }));

          const { error: timingErr } = await Supabase.from("timings").insert(
            timingRows
          );
          if (timingErr) {
            console.error("Supabase insert timings error:", timingErr);
            // optionally rollback taruf (left simple here)
            return res
              .status(500)
              .json({ success: false, error: "Failed to save timings" });
          }
        }

        // return created taruf with timings and members using same logic as GET:
        const { data: tarufData = [], error: fetchErr } = await Supabase.from(
          "tarufs"
        )
          .select("*, timings(*)")
          .eq("id", tarufId);

        if (fetchErr) {
          console.error("Supabase fetch new taruf error:", fetchErr);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }

        // Attach members using same method as GET (optional; here we fetch taruf row(s) and return single)
        // reuse the GET logic: find members rows for this taruf
        const tarufRow = (tarufData && tarufData[0]) || created;
        // fetch taruf_members for this taruf
        const { data: tmData = [], error: tmErr } = await Supabase.from(
          "taruf_members"
        )
          .select("*")
          .eq("taruf_id", tarufId);

        if (tmErr) {
          console.error("Supabase taruf_members fetch error:", tmErr);
          // continue without members
        }

        let members = [];
        if (tmData && tmData.length) {
          const itsList = tmData.map((m) => m.member_its).filter(Boolean);
          const { data: memData = [], error: memErr } = await Supabase.from(
            "members"
          )
            .select("id, its_number, name")
            .in("its_number", itsList);

          if (!memErr) {
            const memMap = {};
            memData.forEach((m) => {
              memMap[Number(m.its_number)] = m;
            });
            members = tmData.map((tm) => ({
              id: tm.id,
              member_its: Number(tm.member_its),
              member_id: memMap[Number(tm.member_its)]?.id ?? null,
              name: memMap[Number(tm.member_its)]?.name ?? null,
            }));
          }
        }

        const resultTaruf = { ...tarufRow, members };
        return res.status(201).json({ success: true, taruf: resultTaruf });
      } catch (err) {
        console.error("POST /tarufs error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }

    // === PUT: update an existing taruf and its timings (replace timings) ===
    if (req.method === "PUT") {
      try {
        const { id, name, location_id, timings = [] } = req.body || {};
        if (!id)
          return res.status(400).json({ success: false, error: "Missing id" });
        if (!name)
          return res
            .status(400)
            .json({ success: false, error: "Missing name" });

        const updateRow = {
          name,
          location_id: location_id ?? null,

          updated_at: new Date().toISOString(),
        };

        const { data: updated, error: updateErr } = await Supabase.from(
          "tarufs"
        )
          .update(updateRow)
          .eq("id", Number(id))
          .select()
          .single();

        if (updateErr) {
          console.error("Supabase update taruf error:", updateErr);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }

        // Replace timings: simplest approach: delete existing timings for this taruf and insert provided ones
        const { error: delErr } = await Supabase.from("timings")
          .delete()
          .eq("taruf_id", Number(id));
        if (delErr) {
          console.error("Supabase delete timings error:", delErr);
          // continue; attempt to insert new timings nonetheless
        }

        if (Array.isArray(timings) && timings.length > 0) {
          const timingRows = timings.map((t) => ({
            taruf_id: Number(id),
            date: t.date ?? null,
            start_time: t.start_time ?? t.startTime ?? null,
            end_time: t.end_time ?? t.endTime ?? null,
            created_at: new Date().toISOString(),
          }));
          const { error: timingInsertErr } = await Supabase.from(
            "timings"
          ).insert(timingRows);
          if (timingInsertErr) {
            console.error(
              "Supabase insert timings error (PUT):",
              timingInsertErr
            );
            return res
              .status(500)
              .json({ success: false, error: "Failed to save timings" });
          }
        }

        // return updated taruf with timings (select same as GET)
        const { data: tarufData = [], error: fetchErr } = await Supabase.from(
          "tarufs"
        )
          .select("*, timings(*)")
          .eq("id", Number(id));

        if (fetchErr) {
          console.error("Supabase fetch updated taruf error:", fetchErr);
          return res
            .status(500)
            .json({ success: false, error: "Database error" });
        }

        // attach members same as GET
        const tarufRow = tarufData[0] || updated;
        const { data: tmData = [], error: tmErr } = await Supabase.from(
          "taruf_members"
        )
          .select("*")
          .eq("taruf_id", Number(id));

        let members = [];
        if (tmData && tmData.length) {
          const itsList = tmData.map((m) => m.member_its).filter(Boolean);
          const { data: memData = [], error: memErr } = await Supabase.from(
            "members"
          )
            .select("id, its_number, name")
            .in("its_number", itsList);

          if (!memErr) {
            const memMap = {};
            memData.forEach((m) => {
              memMap[Number(m.its_number)] = m;
            });
            members = tmData.map((tm) => ({
              id: tm.id,
              member_its: Number(tm.member_its),
              member_id: memMap[Number(tm.member_its)]?.id ?? null,
              name: memMap[Number(tm.member_its)]?.name ?? null,
            }));
          }
        }

        const resultTaruf = { ...tarufRow, members };
        return res.status(200).json({ success: true, taruf: resultTaruf });
      } catch (err) {
        console.error("PUT /tarufs error:", err);
        return res.status(500).json({ success: false, error: "Server error" });
      }
    }
  } catch (err) {
    console.error("Tarufs handler error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export { Tarufs };
