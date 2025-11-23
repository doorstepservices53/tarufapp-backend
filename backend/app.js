import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import candidatesRouter from "./routes/candidates.js";

// if (process.env.NODE_ENV != "production") {
//   require("dotenv").config();
// }

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
// mount API routes under /api
app.use("/api", candidatesRouter);

app.listen(process.env.PORT, () => {
  console.log(`App is listening on port ${process.env.PORT}`);
});
