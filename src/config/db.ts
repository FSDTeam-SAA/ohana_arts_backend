import mongoose from "mongoose";

export async function connectDB(p0: string) {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("❌ MONGO_URI is not defined in .env");
  }

  if (mongoose.connection.readyState === 1) return;

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("✅ Mongo connected");
}
