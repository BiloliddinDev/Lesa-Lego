import mongoose, { Schema, Document } from "mongoose";
import { ICategory } from "./Category";

export interface IEquipment extends Document {
  category: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  totalQuantity: number;
  rentedQuantity: number;
  dailyRate: number;
  isActive: boolean;
}

const equipmentSchema = new Schema<IEquipment>(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    rentedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    dailyRate: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

equipmentSchema.virtual("availableQuantity").get(function (this: IEquipment) {
  return this.totalQuantity - this.rentedQuantity;
});

equipmentSchema.index({ category: 1 });
equipmentSchema.index({ isActive: 1 });

export const Equipment = mongoose.model<IEquipment>("Equipment", equipmentSchema);
