import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  userFullName: string;
  userRole: string;
  action: string;
  resourceType?: string;
  resourceId?: mongoose.Types.ObjectId;
  resourceName?: string;
  before?: any;
  after?: any;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userFullName: { type: String },
    userRole: { type: String },
    action: {
      type: String,
      required: true,
    },
    resourceType: { type: String },
    resourceId: { type: Schema.Types.ObjectId },
    resourceName: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
