// routes/admin.js
import express from "express";
import { Dashboard } from "../controller/dashboardController.js";
import { Meetings } from "../controller/meetingController.js";
import { Tarufs } from "../controller/tarufController.js";
import { UpdateStatus } from "../controller/updateStatus.js";
import { DeleteBtn } from "../controller/deleteBtnController.js";
import { Locations } from "../controller/locationController.js";
import { Designations } from "../controller/designationController.js";
import { Admins } from "../controller/adminController.js";
import { Members } from "../controller/memberController.js";
import { Candidates } from "../controller/candidateController.js";
import { Attendances } from "../controller/attendanceController.js";
import { addAttendanceMaster } from "../controller/addAttendanceMaster.js";
import { updateAttendance } from "../controller/updateAttendance.js";
import {
  addTarufMembers,
  deleteTarufMembers,
  deleteTarufMemberById,
  fetchTarufMembers,
} from "../controller/tarufMember.js";
import {
  TarufRegisters,
  TarufRegistersByIds,
} from "../controller/tarufRegisters.js";
import {
  addIndividualCandidateAttendance,
  bulkAddCandidateAttendance,
  deleteIndividualCandidateAttendance,
  getCandidateAttendanceData,
} from "../controller/candidateAttendance.js";
import { getAllRound1Slots } from "../controller/SlotsAssignment.js";
import {
  getCandidatesNotSelectors,
  getRegistrations,
  getRound1Selected,
} from "../controller/yetNotSelects.js";

const router = express.Router();

router.get("/dashboard", Dashboard);

// meetings
router.get("/meetings", Meetings);
router.post("/meetings", Meetings);
router.put("/meetings", Meetings);

// tarufs
router.get("/tarufs", Tarufs);
router.post("/tarufs", Tarufs);
router.put("/tarufs", Tarufs);

// locations
router.get("/locations", Locations);
router.post("/locations", Locations);
router.put("/locations", Locations);

// designations
router.get("/designations", Designations);
router.post("/designations", Designations);
router.put("/designations", Designations);

// admins
router.get("/admins", Admins);
router.post("/admins", Admins);
router.put("/admins", Admins);

// members
router.get("/members", Members);
router.post("/members", Members);
router.put("/members", Members);

// candidates
router.get("/candidates", Candidates);
router.post("/candidates", Candidates);
router.put("/candidates", Candidates);

// attendances (admin + member branches live inside controller)
router.get("/attendance", Attendances);
router.post("/attendance", Attendances);
router.post("/attendances", addAttendanceMaster); // add many (modal)
router.put("/updateAttendance", updateAttendance); // mark single attendance

// GET for list/status (Uses query string ?taruf_id=...)
router.get("/candidate_attendance", getCandidateAttendanceData);
router.get("/round1_slots", getAllRound1Slots);

// POST for individual attendance (Used by the "Mark Present" button)
router.post("/candidate_attendance", addIndividualCandidateAttendance);

// POST for bulk attendance (Used by the modal submit)
router.post("/candidate_attendances", bulkAddCandidateAttendance);

// DELETE for individual attendance (Uses URL parameters)
router.delete(
  "/candidate_attendance/:itsNumber/:tarufId",
  deleteIndividualCandidateAttendance
);
// update status / delete helper
router.put("/update-status", UpdateStatus);
router.delete("/deleteBtn", DeleteBtn);

// ----------------- Taruf Members routes (NEW) -----------------
// get taruf members
router.get("/taruf-members", fetchTarufMembers);

// Add members to a taruf
router.post("/taruf-members", addTarufMembers);

// Bulk delete members from a taruf
// NOTE: DELETE with a JSON body is supported by express.json(), but some HTTP clients/proxies may strip bodies.
// If you see empty req.body on DELETE, change this to POST or use a route like POST /taruf-members/delete
router.delete("/taruf-members", deleteTarufMembers);

// Delete single taruf_member by its taruf_members.id
router.delete("/taruf-members/:id", deleteTarufMemberById);

// all wo registered in taruf
// registrations list for a taruf
router.get("/registrations", TarufRegisters);

// registration detail by id
router.get("/registrations/:id", TarufRegistersByIds);

router.get("/registrations", getRegistrations);
router.get("/round1_selected", getRound1Selected);
router.get("/candidates_not_selectors", getCandidatesNotSelectors);

export default router;
