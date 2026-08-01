import { CompanySettings } from "../models/CompanySettings";
import { AuditLog } from "../models/AuditLog";
import { AppError } from "../utils/AppError";

export class SettingsService {
  async get() {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({});
    }
    return settings;
  }

  async update(data: Record<string, unknown>, userId: string) {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create(data);

      await AuditLog.create({
        userId,
        action: "settings.create",
        resourceType: "settings",
        resourceId: settings._id,
        resourceName: "Kompaniya sozlamalari",
        after: { ...data },
      });
    } else {
      const before = { ...settings.toObject() };
      Object.assign(settings, data);
      await settings.save();

      await AuditLog.create({
        userId,
        action: "settings.update",
        resourceType: "settings",
        resourceId: settings._id,
        resourceName: "Kompaniya sozlamalari",
        before: { companyName: before.companyName, ownerName: before.ownerName },
        after: { companyName: data.companyName, ownerName: data.ownerName },
      });
    }
    return settings;
  }
}

export const settingsService = new SettingsService();
