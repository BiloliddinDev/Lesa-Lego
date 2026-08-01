import mongoose, { Schema, Document } from "mongoose";

export interface IClient extends Document {
  fullName: string;
  phone: string;
  telegramId?: number;
  address?: string;
  note?: string;
  totalDebt: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
}

const clientSchema = new Schema<IClient>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    telegramId: {
      type: Number,
      sparse: true,
      unique: true,
    },
    address: {
      type: String,
    },
    note: {
      type: String,
    },
    totalDebt: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

clientSchema.index({ phone: 1 });
clientSchema.index({ telegramId: 1 }, { sparse: true });
clientSchema.index({ fullName: "text" });

export const Client = mongoose.model<IClient>("Client", clientSchema);
