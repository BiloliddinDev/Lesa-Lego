import mongoose, { Schema, Document } from "mongoose";

export interface ICompanySettings extends Document {
  companyName: string;
  ownerName: string;
  address: string;
  phone: string;
  inn?: string;
  bankAccount?: string;
  bankName?: string;
  logoBase64?: string;
  stampBase64?: string;
  signatureBase64?: string;
  contractTemplate?: string;
  rentalTerms?: string;
}

const companySettingsSchema = new Schema<ICompanySettings>(
  {
    companyName: { type: String, default: "" },
    ownerName: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    inn: { type: String },
    bankAccount: { type: String },
    bankName: { type: String },
    logoBase64: { type: String },
    stampBase64: { type: String },
    signatureBase64: { type: String },
    contractTemplate: { type: String },
    rentalTerms: { type: String },
  },
  { timestamps: true }
);

// Singleton: ensure only one document exists
companySettingsSchema.pre("save", async function (next) {
  if (this.isNew) {
    const count = await mongoose.model("CompanySettings").countDocuments();
    if (count > 0) {
      return next(new Error("CompanySettings is a singleton"));
    }
  }
  next();
});

export const CompanySettings = mongoose.model<ICompanySettings>("CompanySettings", companySettingsSchema);
