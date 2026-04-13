"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { getChatMessages, sendChatMessage } from "@/actions/chat";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";

interface ChatMessage {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string } | null;
}

export default function ChatPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth = false) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });

    // Initial load
    getChatMessages(poolId).then((msgs) => {
      setMessages(msgs as ChatMessage[]);
      setLoading(false);
      setTimeout(() => scrollToBottom(), 50);
    });

    // Subscribe to new messages via Postgres Changes
    const channel = supabase
      .channel(`chat:${poolId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `pool_id=eq.${poolId}`,
        },
        async (payload) => {
          // Fetch the full message with profile join
          const { data: msg } = await supabase
            .from("chat_messages")
            .select("*, profiles(display_name)")
            .eq("id", payload.new.id)
            .single();

          if (msg) {
            setMessages((prev) => {
              // Deduplicate by id
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg as ChatMessage];
            });
            // Auto-scroll if already at bottom
            if (atBottomRef.current) {
              setTimeout(() => scrollToBottom(true), 50);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolId, scrollToBottom]);

  // Track scroll position to know if user is at bottom
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    atBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    await sendChatMessage(poolId, content);
    // Realtime will deliver the new message via the subscription
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    } else if (days === 1) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
        <div className="flex-shrink-0 pb-4">
          <h1 className="text-2xl font-bold text-white">Smack Talk</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex-shrink-0 pb-4">
        <h1 className="text-2xl font-bold text-white">Smack Talk</h1>
        <p className="text-sm text-slate-400 mt-1">
          {messages.length} messages
        </p>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-4 pb-4 -mx-4 px-4"
      >
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-500">No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isSelf = msg.user_id === currentUserId;
          const name =
            (msg.profiles as unknown as { display_name: string })?.display_name ??
            "Unknown";

          if (isSelf) {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[75%]">
                  <div className="bg-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1 text-right">
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-400 flex-shrink-0">
                {name.charAt(0)}
              </div>
              <div className="max-w-[75%]">
                <span className="text-xs font-medium text-slate-400">
                  {name}
                </span>
                <div className="bg-slate-800 text-slate-300 rounded-2xl rounded-tl-sm px-4 py-2.5 mt-0.5">
                  <p className="text-sm">{msg.content}</p>
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Talk smack..."
            maxLength={500}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
