import express from "express";
import {
  getActiveTarufs,
  checkRegistration,
  setPassword,
  candidateLogin,
  getRegistration,
  submitRound1,
  // listRegistrations is now merged with getRegistrations
  getRegistrationById,
  getRegistrations, // GET /api/registrations?taruf_id=...
  getRound1Selected, // GET /api/round1_selected?taruf_id=...&selector_id=...
  submitRound2,
  addRound1Selection,
  deleteRound1Selection,
  // updateRound1Room, // <-- ADDED: Controller for room number update
  setRound1FirstChoice,
  handleAutoAssign,
  handleClearAutoSlots,
  handleManualSlotUpdate,
  handleCandidateSchedule,
  updateRound1Timings,
  updateFirstChoice,
} from "../controller/candidates.js";
import {
  getAllCandidatesWithFeedback,
  getFeedback,
  submitFeedback,
  submitMemberFeedback,
} from "../controller/feedback.js";
import { getCandidatesNotSelectors } from "../controller/yetNotSelects.js";

const router = express.Router();

// prefix on server will be /api (in server.js). So final paths are:
// GET  /api/tarufs/active
// POST /api/candidates/check
// POST /api/candidates/set-password
// POST /api/candidates/login
// GET  /api/candidates/:id

router.get("/tarufs/active", getActiveTarufs);
router.post("/candidates/check", checkRegistration);
router.post("/candidates/set-password", setPassword);
router.post("/candidates/login", candidateLogin);
router.get("/candidates/:id", getRegistration);

// NEW: registrations list and detail matching frontend requests
router.get("/registrations", getRegistrations); // Consolidated list route
router.get("/registrations/:id", getRegistrationById);
router.post("/:taruf_id/round1/submit", submitRound1);

router.get("/round1_selected", getRound1Selected);

// Legacy routes (kept for compatibility)
router.get("/registrations", getRegistrations);
router.get("/round1_selected", getRound1Selected);

// OPTIMIZED Route: Gets all registrations, filters out selectors, and returns the result (Used by frontend)
router.get("/getCandidatesNotSelectors", getCandidatesNotSelectors);
// Auto/Manual Slot Assignment/Clearing routes
router.post("/:taruf_id/round1_slots/auto", handleAutoAssign);
router.post("/:taruf_id/round1_slots/clear", handleClearAutoSlots);
router.post("/round1_slot/manual-update", handleManualSlotUpdate);
router.post("/:taruf_id/round1_slots/timings", updateRound1Timings);
router.post("/round1_slot/first-choice-update", updateFirstChoice);

// --- CANDIDATE SCHEDULE AND ROUND 2 ---
router.get(
  "/candidate_schedule/:taruf_id/:registration_id",
  handleCandidateSchedule
);
router.post("/:taruf_id/round2/submit", submitRound2);

// add/delete single selection (incremental) and first choice update
router.post("/:taruf_id/round1_selected", addRound1Selection);
router.delete("/:taruf_id/round1_selected", deleteRound1Selection);
router.patch("/:taruf_id/round1_selected/first_choice", setRound1FirstChoice);

//feedback route
router.post("/feedback", submitFeedback);
router.get("/feedback", getFeedback);
router.get("/members-feedback/all", getAllCandidatesWithFeedback);

// POST a review
router.post("/members-feedback", submitMemberFeedback);

export default router;
