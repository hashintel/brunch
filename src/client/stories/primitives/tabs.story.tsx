import { useState } from 'react';

import { TabSwitcher } from '@/client/components/app-shell';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export const TabsStory = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <ScrollArea className="h-screen">
      <div className="mx-auto max-w-2xl px-8 py-12">
        <h1 className="text-base font-medium text-ink">Tabs</h1>
        <p className="mt-1 text-sm text-sub">
          <code className="rounded bg-tint px-1 text-xs">TabSwitcher</code> — interactive tab bar.
        </p>

        <Separator className="my-8" />

        <h2 className="text-sm font-medium text-ink">Interactive demo</h2>
        <div className="mt-4">
          <TabSwitcher
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'details', label: 'Details' },
              { key: 'history', label: 'History' },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <div className="mt-4 rounded-xl border border-rule p-4">
            <p className="text-sm text-sub">
              Active tab: <span className="font-medium text-ink">{activeTab}</span>
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
