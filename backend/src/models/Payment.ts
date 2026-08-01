import mongoose, { Schema, Document } from "mongoose";

export interface IPayment extends Document {
  rental: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  amount: number;
  method: "cash" | "card" | "transfer";
  note?: string;
  createdBy: mongoose.Types.ObjectId;
}

const paymentSchema = new Schema<IPayment>(
  {
    rental: {
      type: Schema.Types.ObjectId,
      ref: "Rental",
      required: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    method: {
      type: String,
      enum: ["cash", "card", "transfer"],
      required: true,
    },
    note: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ rental: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ createdAt: -1 });

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);
