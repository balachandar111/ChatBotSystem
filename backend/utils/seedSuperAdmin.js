require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const SuperAdmin = require("../models/SuperAdmin");

(async () => {
  await connectDB();

  const username = process.env.SEED_SUPERADMIN_USERNAME || "superadmin";
  const existing = await SuperAdmin.findOne({ username });

  if (existing) {
    console.log(`Superadmin "${username}" already exists. Skipping.`);
    process.exit(0);
  }

  const password = process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMe@123";
  const hashedPassword = await bcrypt.hash(password, 10);

  await SuperAdmin.create({
    name: process.env.SEED_SUPERADMIN_NAME || "Super Admin",
    username,
    password: hashedPassword,
  });

  console.log(`Superadmin created -> username: ${username} / password: ${password}`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
