import mongoose from "mongoose";

const clickSchema = new mongoose.Schema(
  {
    url: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: true,
      index: true,
    },
    visitorId: {
      type: String,
      required: true,
    },
    clickedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  { versionKey: false }
);

export default mongoose.model("Click", clickSchema);
