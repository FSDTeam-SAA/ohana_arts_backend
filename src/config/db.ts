import mongoose from "mongoose";

export async function connectDB(uri: string) {
  if (mongoose.connection.readyState === 1) return;
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("✅ Mongo connected");
}
