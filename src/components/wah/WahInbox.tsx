"use client";

import { useState } from "react";
import { WahAccountForm } from "@/components/wah/WahAccountForm";
import { WahAccountSwitcher } from "@/components/wah/WahAccountSwitcher";
import { WahChatPanel } from "@/components/wah/WahChatPanel";
import { WahConversationList } from "@/components/wah/WahConversationList";
import { WahDashboardKpis } from "@/components/wah/WahDashboardKpis";
import {
  useWahAccounts,
  useWahConversations,
  useWahDashboard,
} from "@/components/wah/use-wah-api";

type Filter = "all" | "pending" | "unread";

export function WahInbox({ canManageAccounts = false }: { canManageAccounts?: boolean }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: accountsData, mutate: refreshAccounts } = useWahAccounts();
  const accounts = accountsData?.accounts ?? [];

  const { data: dashboardData, isLoading: dashboardLoading, mutate: refreshDashboard } =
    useWahDashboard(accountId);
  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    mutate: refreshConversations,
  } = useWahConversations(accountId, filter);

  const conversations = conversationsData?.conversations ?? [];

  const refreshLists = () => {
    void refreshDashboard();
    void refreshConversations();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[32rem] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-3">
          <WahAccountSwitcher accounts={accounts} value={accountId} onChange={setAccountId} />
          {canManageAccounts ? (
            <WahAccountForm
              onSaved={(account) => {
                void refreshAccounts();
                setAccountId(account.id);
                setSelectedId(null);
              }}
            />
          ) : null}
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-sm">
          {(
            [
              ["all", "Todas"],
              ["pending", "Pendientes"],
              ["unread", "Sin leer"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                filter === key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <WahDashboardKpis kpis={dashboardData?.kpis} loading={dashboardLoading} />

      <div className="panel-card flex min-h-0 flex-1 overflow-hidden p-0">
        <aside className="flex w-[270px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Conversaciones
            </p>
          </div>
          <div className="min-h-0 flex-1">
            <WahConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              loading={conversationsLoading}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <WahChatPanel conversationId={selectedId} onConversationUpdated={refreshLists} />
        </div>
      </div>
    </div>
  );
}
