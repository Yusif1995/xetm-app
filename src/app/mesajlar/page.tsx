"use client";
// The member's conversation with the group's managers in the active group. They see only their
// own thread and can reply to the managers; other members never see it.
import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { markThreadRead, replyToManagers } from "@/lib/db";
import { useThreadMessages, useThreadSummary } from "@/lib/useGroupData";
import AppLayout from "@/components/AppLayout";
import ThreadView from "@/components/ThreadView";
import { Card, LoadingScreen, PageHeader, button } from "@/components/ui";

export default function MessagesPage() {
  const { user, loading, activeGroupId, activeGroup, activeGroupLoaded } = useAuth();
  const isCreator = !!user && activeGroup?.createdBy === user.uid;
  const summary = useThreadSummary(activeGroupId, isCreator ? undefined : user?.uid);
  const { messages, loaded } = useThreadMessages(activeGroupId, user?.uid, !!user && !isCreator);

  // Opening the conversation reads it
  useEffect(() => {
    if (!user || !summary?.memberUnread) return;
    markThreadRead(activeGroupId, user.uid, "member").catch((err) => console.error("Error marking thread read:", err));
  }, [user, summary?.memberUnread, activeGroupId]);

  if (loading || !user || !activeGroupLoaded || (!isCreator && !loaded)) return <LoadingScreen text="Mesajlar yüklənir..." />;

  return (
    <AppLayout activeTab="dashboard">
      <div className="max-w-[720px] flex flex-col gap-5 md:gap-7">
        <PageHeader
          title="Mesajlar"
          subtitle={activeGroup?.name}
          actions={<Link href="/dashboard" className={button("outline", "sm")}>Bu gün</Link>}
        />
        {isCreator ? (
          <Card>
            <p className="m-0 text-sm text-muted">
              Bu qrupun rəhbəri sənsən. İştirakçılarla yazışmalar İnzibatçı panelində, hər iştirakçının yanındakı &quot;Mesaj&quot; düyməsindədir.
            </p>
            <Link href="/admin" className={button("outline")}>İnzibatçı paneli</Link>
          </Card>
        ) : (
          <Card>
            <p className="m-0 text-[13px] text-muted">
              Burada yalnız sənlə qrup rəhbəri arasındakı yazışma görünür. Digər iştirakçılar bunu görmür.
            </p>
            <ThreadView
              messages={messages}
              mySide="member"
              memberLabel="Sən"
              emptyText="Hələ mesaj yoxdur. Qrup rəhbəri yazanda burada görünəcək."
              placeholder="Qrup rəhbərinə cavab yaz"
              onSend={messages.length > 0 ? (text) => replyToManagers(activeGroupId, text) : undefined}
            />
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
