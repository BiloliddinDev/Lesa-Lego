import mongoose, { Schema, Document } from "mongoose";

export interface IReturnEvent {
  date: Date;
  quantity: number;
  note?: string;
  doneBy: mongoose.Types.ObjectId;
}

export interface IRentalItem {
  equipment: mongoose.Types.ObjectId;
  equipmentName: string;
  equipmentCategory: string;
  quantity: number;
  dailyRate: number;
  returnedQuantity: number;
  returns: IReturnEvent[];
}

export interface IRental extends Document {
  rentalNumber: string;
  client: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  items: IRentalItem[];
  startDate: Date;
  expectedEndDate?: Date;
  endDate?: Date;
  status: "active" | "overdue" | "completed";
  depositAmount: number;
  paidAmount: number;
  note?: string;
  deliveryLocation?: {
    lat: number;
    lng: number;
    label?: string;
  };
}

const rentalSchema = new Schema<IRental>(
  {
    rentalNumber: {
      type: String,
      unique: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        equipment: {
          type: Schema.Types.ObjectId,
          ref: "Equipment",
          required: true,
        },
        equipmentName: { type: String, required: true },
        equipmentCategory: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        dailyRate: { type: Number, required: true, min: 0 },
        returnedQuantity: { type: Number, default: 0 },
        returns: [
          {
            date: { type: Date, required: true },
            quantity: { type: Number, required: true, min: 1 },
            note: { type: String },
            doneBy: { type: Schema.Types.ObjectId, ref: "User" },
          },
        ],
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    expectedEndDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["active", "overdue", "completed"],
      default: "active",
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
    },
    deliveryLocation: {
      lat: { type: Number },
      lng: { type: Number },
      label: { type: String },
    },
  },
  { timestamps: true }
);

rentalSchema.pre("save", async function (next) {
  if (!this.rentalNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model("Rental").countDocuments({
      rentalNumber: new RegExp(`^ARN-${year}-`),
    });
    this.rentalNumber = `ARN-${year}-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

rentalSchema.index({ rentalNumber: 1 });
rentalSchema.index({ client: 1 });
rentalSchema.index({ status: 1 });
rentalSchema.index({ startDate: -1 });
rentalSchema.index({ createdBy: 1 });
rentalSchema.index({ expectedEndDate: 1, status: 1 });

export const Rental = mongoose.model<IRental>("Rental", rentalSchema);
