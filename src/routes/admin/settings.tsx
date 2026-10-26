import { createFileRoute } from "@tanstack/react-router";

import { SettingsPanel } from "@/components/common/settings-panel";

export const Route = createFileRoute("/admin/settings")({ component: Page });

function Page() {
  return (
    <div className="px-4 py-6 sm:px-8">
      <SettingsPanel />
    </div>
  );
}
