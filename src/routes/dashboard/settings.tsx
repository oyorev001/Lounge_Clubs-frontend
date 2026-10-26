import { createFileRoute } from "@tanstack/react-router";

import { SettingsPanel } from "@/components/common/settings-panel";

export const Route = createFileRoute("/dashboard/settings")({ component: Page });

function Page() {
  return (
    <div className="px-4 py-6 sm:px-8">
      <SettingsPanel />
    </div>
  );
}
