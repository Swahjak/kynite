"use client";

import { LinkedAccountsSection } from "./linked-accounts-section";

interface GoogleSyncSettingsProps {
  familyId: string;
}

export function GoogleSyncSettings({ familyId }: GoogleSyncSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Google Calendar Sync</h3>
        <p className="text-muted-foreground text-sm">
          Link Google accounts and select which calendars to sync with your
          family planner.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <h4 className="mb-4 text-sm font-medium">Linked Google Accounts</h4>
        <LinkedAccountsSection familyId={familyId} />
      </div>

      <div className="rounded-lg border p-6">
        <h4 className="mb-4 text-sm font-medium">Sync Settings</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-sync interval</p>
              <p className="text-muted-foreground text-xs">
                Calendars sync automatically every 5 minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
