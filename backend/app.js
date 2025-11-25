import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import candidatesRouter from "./routes/candidates.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔒 Restrict access only to your WiFi range (Ahcns → 192.168.152.xxx)
const allowedSubnet = "192.168.152.";

app.use((req, res, next) => {
  const clientIP = req.ip.replace("::ffff:", ""); // normalize IPv6-mapped IPv4

  if (clientIP.startsWith(allowedSubnet)) {
    return next(); // allowed
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Connect to the authorized WiFi network."
  });
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api", candidatesRouter);

app.listen(process.env.PORT, () => {
  console.log(`App is listening on port ${process.env.PORT}`);
});
