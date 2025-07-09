const express = require("express");
const cors = require("cors");

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

const apiRoutes = require("./apiRoutes");
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.send("API server đang chạy!");
});

app.listen(port, () => {
  console.log(`✅ Server chạy tại http://localhost:${port}`);
});
