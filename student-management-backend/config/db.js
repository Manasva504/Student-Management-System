const mongoose = require("mongoose");

let isConnected = false; // nothing connected yet when the app starts

const connectDB = async () => {
  if (isConnected) {
    console.log("Using existing MongoDB connection");
    return; // stop here — don't connect a second time
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true; // remember that we're now connected
    console.log("MongoDB Connected");
  } catch (error) {
    console.log("MongoDB Connection Error:");
    console.log(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;