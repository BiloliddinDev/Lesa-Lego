import { IUserType } from "../types/auth.types";
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends IUserType, Document {}

const userSchema = new Schema<IUser>(
  {
    telegramId: {
      type: Number,
      unique: true,
      sparse: true,
    },
    username: {
      type: String,
      default: "",
      index: true,
    },
    name: {
      type: String,
      default: "Full Name",
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["ADMIN", "WORKER"],
      default: "WORKER",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>("User", userSchema);
