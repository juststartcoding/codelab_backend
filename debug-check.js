require("dotenv").config();
const mongoose = require("mongoose");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require("./models/User");

  const count = await User.countDocuments();
  console.log("Total users in DB:", count);

  const admin = await User.findOne({ email: "admin@codelab.dev" });
  if (admin) {
    console.log(
      "Admin found:",
      admin.email,
      "| role:",
      admin.role,
      "| has password:",
      !!admin.password,
    );
  } else {
    console.log("❌ Admin NOT found — seed nahi chala!");
  }

  await mongoose.disconnect();
}
check().catch(console.error);
