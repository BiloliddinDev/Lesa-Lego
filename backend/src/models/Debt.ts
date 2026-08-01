import mongoose, { Schema, Document } from "mongoose";

export interface IDebt extends Document {
  client: mongoose.Types.ObjectId;
  rental: mongoose.Types.ObjectId;
  amount: number;
  dueDate?: Date;
  paidDate?: Date;
  status: "pending" | "paid" | "overdue";
  note?: string;
}

const debtSchema = new Schema<IDebt>(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    rental: {
      type: Schema.Types.ObjectId,
      ref: "Rental",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    dueDate: {
      type: Date,
    },
    paidDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "overdue"],
      default: "pending",
    },
    note: {
      type: String,
    },
  },
  { timestamps: true }
);

debtSchema.index({ client: 1 });
debtSchema.index({ status: 1 });
debtSchema.index({ dueDate: 1, status: 1 });

export const Debt = mongoose.model<IDebt>("Debt", debtSchema);
