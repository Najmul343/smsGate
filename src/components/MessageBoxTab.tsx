import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  User,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  RefreshCw,
  Plus,
  Radio,
  Copy,
  Info,
  Smartphone,
  Trash2,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { SmsRecord, SmsAccount, ChatMessage } from '../types/sms';
import { loadChatMessages, saveChatMessages, loadRecords, saveRecords } from '../utils/dbStore';

interface MessageBoxTabProps {
  records: SmsRecord[];
  accounts: SmsAccount[];
  lastMessage?: string;
  messageVariants?: string[];
  onRecordsUpdated: (updated: SmsRecord[]) => void;
  onNavigateToSend?: (phoneNumber?: string) => void;
}

// Sub-component for individual chat message bubble (React.memo for instantaneous list rendering)
const MessageBubble = React.memo(({ msg, contactName, isOutgoing }: { msg: ChatMessage; contactName?: string; isOutgoing: boolean }) => {
  const msgTime = useMemo(() => {
    try {
      return new Date(msg.timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return msg.timestamp;
    }
  }, [msg.timestamp]);

  return (
    <div className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-sm text-xs space-y-1.5 ${
          isOutgoing
            ? 'bg-indigo-600 text-white rounded-tr-none'
            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-tl-none'
        }`}
      >
        <div className={`flex items-center justify-between gap-4 text-[10px] ${isOutgoing ? 'text-indigo-200' : 'text-slate-400'}`}>
          <span className="font-bold">
            {isOutgoing ? `You (via ${msg.apiAccount || 'API'})` : contactName || msg.phone}
          </span>
          <span className="font-mono">{msgTime}</span>
        </div>

        <p className="whitespace-pre-wrap leading-relaxed font-normal text-xs select-text">
          {msg.text}
        </p>

        {isOutgoing ? (
          <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] font-bold text-indigo-100">
            {msg.status === 'DELIVERED' && (
              <span className="flex items-center gap-1 text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/50">
                <CheckCheck className="w-3 h-3 text-emerald-400" /> Delivered
              </span>
            )}
            {msg.status === 'SENT' && (
              <span className="flex items-center gap-1 text-indigo-200">
                <Check className="w-3 h-3" /> Dispatched
              </span>
            )}
            {msg.status === 'PENDING' && (
              <span className="flex items-center gap-1 text-amber-300">
                <Clock className="w-3 h-3" /> Pending
              </span>
            )}
            {msg.status === 'FAILED' && (
              <span className="flex items-center gap-1 text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-800">
                <AlertCircle className="w-3 h-3 text-rose-400" /> {msg.error || 'Failed'}
              </span>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 pt-1">
            <Radio className="w-3 h-3" /> Incoming SMS
          </div>
        )}
      </div>
    </div>
  );
});

// Sub-component for composer box to isolate typing re-renders
const ChatComposer = React.memo(({
  onSend,
  accounts,
  messageVariants,
  isSending,
  selectedPhone,
  contactName,
}: {
  onSend: (text: string, accountUser: string) => void;
  accounts: SmsAccount[];
  messageVariants: string[];
  isSending: boolean;
  selectedPhone: string;
  contactName?: string;
}) => {
  const [replyText, setReplyText] = useState('');
  const [selectedAccountUser, setSelectedAccountUser] = useState('');

  useEffect(() => {
    const activeAccs = accounts.filter((a) => a.enabled);
    if (activeAccs.length > 0 && !selectedAccountUser) {
      setSelectedAccountUser(activeAccs[0].user);
    }
  }, [accounts, selectedAccountUser]);

  const handleSendClick = () => {
    if (!replyText.trim() || isSending) return;
    onSend(replyText.trim(), selectedAccountUser);
    setReplyText('');
  };

  const charCount = replyText.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

  return (
    <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px]">Route API:</span>
          <select
            value={selectedAccountUser}
            onChange={(e) => setSelectedAccountUser(e.target.value)}
            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            {accounts.filter((a) => a.enabled).map((acc) => (
              <option key={acc.user} value={acc.user}>
                {acc.name || acc.user} ({acc.user})
              </option>
            ))}
          </select>
        </div>

        {messageVariants.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px]">Template:</span>
            <select
              onChange={(e) => {
                if (e.target.value) setReplyText(e.target.value);
              }}
              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[180px] truncate"
            >
              <option value="">-- Choose Variant --</option>
              {messageVariants.map((v, i) => (
                <option key={i} value={v}>
                  Variant {i + 1}: {v.slice(0, 25)}...
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            rows={2}
            placeholder={`Type reply to ${contactName || selectedPhone}...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendClick();
              }
            }}
            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white resize-none"
          />
          <div className="absolute right-3 bottom-2 text-[10px] font-mono text-slate-400">
            {charCount} / 160 ({smsSegments} SMS)
          </div>
        </div>

        <button
          onClick={handleSendClick}
          disabled={isSending || !replyText.trim()}
          className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Send className={`w-4 h-4 ${isSending ? 'animate-bounce' : ''}`} />
          <span>{isSending ? 'Sending...' : 'Send SMS'}</span>
        </button>
      </div>
    </div>
  );
});

export const MessageBoxTab: React.FC<MessageBoxTabProps> = ({
  records,
  accounts,
  messageVariants = [],
  onRecordsUpdated,
  onNavigateToSend,
}) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadChatMessages());
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing' | 'failed'>('all');
  const [selectedApiFilter, setSelectedApiFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'threads' | 'log'>('threads');

  // Pagination / Lazy load state for high performance
  const [visibleThreadCount, setVisibleThreadCount] = useState<number>(25);
  const [visibleLogCount, setVisibleLogCount] = useState<number>(25);
  const [visibleActiveMsgCount, setVisibleActiveMsgCount] = useState<number>(25);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);

  // Modals
  const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [showLogMobileModal, setShowLogMobileModal] = useState<boolean>(false);
  const [showLogReceivedModal, setShowLogReceivedModal] = useState<boolean>(false);
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [newChatPhone, setNewChatPhone] = useState<string>('');
  const [newChatName, setNewChatName] = useState<string>('');

  // Mobile Sent logging form
  const [mobileSentPhone, setMobileSentPhone] = useState<string>('');
  const [mobileSentMessage, setMobileSentMessage] = useState<string>('');
  const [mobileSentAccount, setMobileSentAccount] = useState<string>('Mobile Phone SIM');

  // Mobile Received logging form
  const [logReceivedPhone, setLogReceivedPhone] = useState<string>('');
  const [logReceivedMessage, setLogReceivedMessage] = useState<string>('');
  const [logReceivedSenderName, setLogReceivedSenderName] = useState<string>('');

  // Simulation form
  const [simPhone, setSimPhone] = useState<string>('+19876543210');
  const [simMessage, setSimMessage] = useState<string>('Hello! I received your SMS message.');
  const [simDevice, setSimDevice] = useState<string>('Simulator Device');

  // Webhook Test Form state
  const [testWebhookPhone, setTestWebhookPhone] = useState<string>('+1234567890');
  const [testWebhookMsg, setTestWebhookMsg] = useState<string>('Sent message from mobile phone');
  const [testWebhookDir, setTestWebhookDir] = useState<'outgoing' | 'incoming'>('outgoing');

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save chat messages to localStorage safely
  useEffect(() => {
    saveChatMessages(chatMessages);
  }, [chatMessages]);

  // High performance unified messages calculation with pre-parsed numeric timestamps
  const unifiedMessages = useMemo(() => {
    const map = new Map<string, ChatMessage & { tsNum: number }>();

    // 1. Synthesize records
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.phone) continue;
      const id = `rec_${r.phone}_${r.created_at || r.last_time || ''}_${(r.message_sent || '').slice(0, 10)}`;
      let status: ChatMessage['status'] = 'PENDING';
      if (r.delivery_status === 'DELIVERED') status = 'DELIVERED';
      else if (r.status === 'SUCCESS') status = 'SENT';
      else if (r.status === 'FAILED') status = 'FAILED';

      const timeStr = r.last_time || r.created_at || '';
      const tsNum = timeStr ? new Date(timeStr).getTime() : 0;

      map.set(id, {
        id,
        phone: r.phone,
        contactName: r.name,
        direction: 'outgoing',
        text: r.message_sent || '(No message text)',
        status,
        timestamp: timeStr || new Date().toISOString(),
        apiAccount: r.api_used || r.assigned_api,
        messageId: r.message_id,
        error: r.last_error,
        tsNum,
      });
    }

    // 2. Synthesize stored chat messages
    for (let i = 0; i < chatMessages.length; i++) {
      const msg = chatMessages[i];
      const tsNum = msg.timestamp ? new Date(msg.timestamp).getTime() : 0;
      map.set(msg.id, { ...msg, tsNum });
    }

    const list = Array.from(map.values());
    list.sort((a, b) => a.tsNum - b.tsNum);
    return list;
  }, [records, chatMessages]);

  // Unique API Accounts present across messages or configured accounts
  const uniqueApiAccounts = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => {
      if (a.user) set.add(a.user);
    });
    unifiedMessages.forEach((m) => {
      if (m.apiAccount) set.add(m.apiAccount);
    });
    return Array.from(set);
  }, [accounts, unifiedMessages]);

  // Threads grouped by phone
  const threadsByPhone = useMemo(() => {
    const threadMap = new Map<
      string,
      {
        phone: string;
        name: string;
        messages: ChatMessage[];
        lastMsg: ChatMessage & { tsNum: number };
        hasIncoming: boolean;
        hasFailed: boolean;
      }
    >();

    for (let i = 0; i < unifiedMessages.length; i++) {
      const msg = unifiedMessages[i];
      const phone = msg.phone;
      if (!threadMap.has(phone)) {
        threadMap.set(phone, {
          phone,
          name: msg.contactName || '',
          messages: [],
          lastMsg: msg,
          hasIncoming: false,
          hasFailed: false,
        });
      }

      const thread = threadMap.get(phone)!;
      thread.messages.push(msg);
      if (msg.contactName && !thread.name) {
        thread.name = msg.contactName;
      }
      thread.lastMsg = msg;
      if (msg.direction === 'incoming') thread.hasIncoming = true;
      if (msg.status === 'FAILED') thread.hasFailed = true;
    }

    const threads = Array.from(threadMap.values());
    threads.sort((a, b) => b.lastMsg.tsNum - a.lastMsg.tsNum);
    return threads;
  }, [unifiedMessages]);

  // Filter threads by search query, direction filter, and selected API Account
  const filteredThreads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return threadsByPhone.filter((t) => {
      const matchesSearch = !query || t.phone.toLowerCase().includes(query) || t.name.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      if (filterType === 'incoming' && !t.hasIncoming) return false;
      if (filterType === 'outgoing' && t.hasIncoming) return false;
      if (filterType === 'failed' && !t.hasFailed) return false;

      if (selectedApiFilter !== 'all') {
        const hasApiMatch = t.messages.some((m) => m.apiAccount === selectedApiFilter);
        if (!hasApiMatch) return false;
      }

      return true;
    });
  }, [threadsByPhone, searchQuery, filterType, selectedApiFilter]);

  // Flat chronological messages for "All Messages Log / By API" mode
  const allFilteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = unifiedMessages.filter((m) => {
      const matchesQuery =
        !query ||
        m.phone.toLowerCase().includes(query) ||
        (m.contactName && m.contactName.toLowerCase().includes(query)) ||
        m.text.toLowerCase().includes(query);
      if (!matchesQuery) return false;

      if (filterType === 'incoming' && m.direction !== 'incoming') return false;
      if (filterType === 'outgoing' && m.direction !== 'outgoing') return false;
      if (filterType === 'failed' && m.status !== 'FAILED') return false;

      if (selectedApiFilter !== 'all' && m.apiAccount !== selectedApiFilter) return false;

      return true;
    });

    return list.slice().reverse(); // Newest first
  }, [unifiedMessages, searchQuery, filterType, selectedApiFilter]);

  // Active Thread Data
  const activeThread = useMemo(() => {
    return threadsByPhone.find((t) => t.phone === selectedPhone);
  }, [threadsByPhone, selectedPhone]);

  // Reset pagination when search query or filters change
  useEffect(() => {
    setVisibleThreadCount(25);
    setVisibleLogCount(25);
  }, [searchQuery, filterType, selectedApiFilter, viewMode]);

  useEffect(() => {
    setVisibleActiveMsgCount(25);
  }, [selectedPhone]);

  // Sliced lists for fast rendering
  const displayedThreads = useMemo(() => {
    return filteredThreads.slice(0, visibleThreadCount);
  }, [filteredThreads, visibleThreadCount]);

  const displayedLogMessages = useMemo(() => {
    return allFilteredMessages.slice(0, visibleLogCount);
  }, [allFilteredMessages, visibleLogCount]);

  const displayedActiveMessages = useMemo(() => {
    if (!activeThread) return [];
    const total = activeThread.messages.length;
    if (total <= visibleActiveMsgCount) return activeThread.messages;
    return activeThread.messages.slice(total - visibleActiveMsgCount);
  }, [activeThread, visibleActiveMsgCount]);

  // Infinite scroll load trigger for contact threads
  const handleThreadScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      if (visibleThreadCount < filteredThreads.length) {
        setVisibleThreadCount((prev) => Math.min(prev + 25, filteredThreads.length));
      }
    }
  };

  // Infinite scroll load trigger for active chat conversation (scroll up to load older messages)
  const handleActiveChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop < 80 && activeThread && activeThread.messages.length > visibleActiveMsgCount) {
      setVisibleActiveMsgCount((prev) => Math.min(prev + 25, activeThread.messages.length));
    }
  };

  // Infinite scroll load trigger for log messages
  const handleLogScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (visibleLogCount < allFilteredMessages.length) {
        setVisibleLogCount((prev) => Math.min(prev + 25, allFilteredMessages.length));
      }
    }
  };

  // Silent background fetch for inbound & mobile-sent webhooks
  const fetchWebhookInbound = useCallback(async (manual = false) => {
    if (manual) setIsSyncing(true);
    try {
      const res = await fetch('/api/sms/webhook');
      if (res.ok) {
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          setChatMessages((prev) => {
            const updated = [...prev];
            let addedCount = 0;
            let statusUpdated = false;

            data.messages.forEach((item: any) => {
              const isOut =
                item.direction === 'outgoing' ||
                (item.event && String(item.event).toLowerCase().includes('sent'));
              const itemStatus = item.status || (isOut ? 'SENT' : 'RECEIVED');

              // 1. Try to find existing message by ID or by phone + text match for outgoing status update
              const idx = updated.findIndex((m) => {
                if (m.id === item.id) return true;
                if (isOut && m.direction === 'outgoing' && m.phone === item.phone && m.text === item.message) {
                  return true;
                }
                return false;
              });

              if (idx !== -1) {
                // Update status if changed
                if (updated[idx].status !== itemStatus) {
                  updated[idx] = {
                    ...updated[idx],
                    status: itemStatus,
                  };
                  statusUpdated = true;
                }
              } else {
                // Add new message
                updated.push({
                  id: item.id || `wh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                  phone: item.phone,
                  direction: isOut ? 'outgoing' : 'incoming',
                  text: item.message,
                  status: itemStatus,
                  timestamp: item.timestamp || new Date().toISOString(),
                  apiAccount: item.account || item.deviceId || 'Mobile Gateway',
                });
                addedCount++;
              }
            });

            if (addedCount > 0) {
              setSendFeedback(`📥 Automatically synced ${addedCount} new SMS message(s) live!`);
              setTimeout(() => setSendFeedback(null), 4000);
            } else if (statusUpdated) {
              setSendFeedback(`🔄 Message delivery status updated live!`);
              setTimeout(() => setSendFeedback(null), 3000);
            } else if (manual) {
              setSendFeedback(`✅ Up to date (${data.messages.length} Webhook messages checked)`);
            }
            return updated;
          });
        } else if (manual) {
          setSendFeedback('ℹ️ Webhook buffer is empty. You can post directly or use Log Mobile Sent SMS.');
        }
      }
    } catch (err: any) {
      if (manual) {
        setSendFeedback(`⚠️ Webhook sync: ${err.message || 'Server reconnecting...'}`);
      }
    } finally {
      if (manual) {
        setIsSyncing(false);
        setTimeout(() => setSendFeedback(null), 3500);
      }
    }
  }, []);

  // Log Mobile Sent SMS Manually
  const handleSaveMobileSentSMS = () => {
    if (!mobileSentPhone.trim() || !mobileSentMessage.trim()) return;
    const cleanPhone = mobileSentPhone.trim();
    const newMsg: ChatMessage = {
      id: `mob_sent_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      phone: cleanPhone,
      direction: 'outgoing',
      text: mobileSentMessage.trim(),
      status: 'SENT',
      timestamp: new Date().toISOString(),
      apiAccount: mobileSentAccount || 'Mobile Phone SIM',
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setSelectedPhone(cleanPhone);
    setShowLogMobileModal(false);
    setMobileSentPhone('');
    setMobileSentMessage('');
    setSendFeedback(`📱 Logged mobile sent SMS to ${cleanPhone}`);
    setTimeout(() => setSendFeedback(null), 3500);
  };

  // Log Received SMS from Friend Manually
  const handleSaveReceivedSMS = () => {
    if (!logReceivedPhone.trim() || !logReceivedMessage.trim()) return;
    const cleanPhone = logReceivedPhone.trim();
    const newMsg: ChatMessage = {
      id: `in_manual_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      phone: cleanPhone,
      contactName: logReceivedSenderName.trim() || undefined,
      direction: 'incoming',
      text: logReceivedMessage.trim(),
      status: 'RECEIVED',
      timestamp: new Date().toISOString(),
      apiAccount: 'Friend Mobile SMS',
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setSelectedPhone(cleanPhone);
    setShowLogReceivedModal(false);
    setLogReceivedPhone('');
    setLogReceivedMessage('');
    setLogReceivedSenderName('');
    setSendFeedback(`📥 Logged friend reply from ${cleanPhone}`);
    setTimeout(() => setSendFeedback(null), 3500);
  };

  // Test Webhook POST from modal
  const handleTestWebhookPost = async () => {
    if (!testWebhookPhone.trim() || !testWebhookMsg.trim()) return;

    try {
      const payload = {
        event: testWebhookDir === 'outgoing' ? 'sms_sent' : 'sms_received',
        direction: testWebhookDir,
        to: testWebhookDir === 'outgoing' ? testWebhookPhone.trim() : undefined,
        from: testWebhookDir === 'incoming' ? testWebhookPhone.trim() : undefined,
        phone: testWebhookPhone.trim(),
        message: testWebhookMsg.trim(),
        account: 'Mobile App Test',
      };

      const res = await fetch('/api/sms/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchWebhookInbound(true);
        setSelectedPhone(testWebhookPhone.trim());
        setSendFeedback(`✅ Tested Webhook POST (${testWebhookDir} SMS to ${testWebhookPhone.trim()})`);
      } else {
        const errJson = await res.json();
        alert(`Webhook Test Failed: ${errJson.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Webhook Test Error: ${err.message || 'Network error'}`);
    }
  };

  // Poll silently every 3 seconds for instant automatic SMS sync
  useEffect(() => {
    fetchWebhookInbound(false);
    const interval = setInterval(() => fetchWebhookInbound(false), 3000);
    return () => clearInterval(interval);
  }, [fetchWebhookInbound]);

  // Handle Send SMS
  const handleSendSMS = useCallback(
    async (text: string, accountUser: string) => {
      if (!selectedPhone || !text) return;

      const activeAcc = accounts.find((a) => a.user === accountUser) || accounts[0];
      if (!activeAcc) {
        alert('Please configure at least one active API Account in Accounts tab first.');
        return;
      }

      setIsSending(true);
      setSendFeedback('Dispatched to gateway...');

      const now = new Date().toISOString();
      const tempId = `out_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      const tempMsg: ChatMessage = {
        id: tempId,
        phone: selectedPhone,
        contactName: activeThread?.name,
        direction: 'outgoing',
        text,
        status: 'PENDING',
        timestamp: now,
        apiAccount: activeAcc.user,
      };

      setChatMessages((prev) => [...prev, tempMsg]);

      try {
        const response = await fetch('/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account: activeAcc.user,
            password: activeAcc.pwd,
            message: text,
            phoneNumbers: [selectedPhone],
            withDeliveryReport: true,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.success) {
          setChatMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: 'SENT', messageId: data.id || undefined } : m))
          );

          const currentRecs = loadRecords();
          const existingIdx = currentRecs.findIndex((r) => r.phone === selectedPhone);
          if (existingIdx >= 0) {
            currentRecs[existingIdx].status = 'SUCCESS';
            currentRecs[existingIdx].last_time = now;
            currentRecs[existingIdx].api_used = activeAcc.user;
            currentRecs[existingIdx].message_sent = text;
            if (data.id) currentRecs[existingIdx].message_id = String(data.id);
          } else {
            currentRecs.unshift({
              phone: selectedPhone,
              name: activeThread?.name || '',
              status: 'SUCCESS',
              attempts: 1,
              last_error: '',
              last_time: now,
              created_at: now,
              api_used: activeAcc.user,
              assigned_api: activeAcc.user,
              message_sent: text,
              message_id: data.id ? String(data.id) : undefined,
              auto_retry_count: 0,
            });
          }
          saveRecords(currentRecs);
          onRecordsUpdated(currentRecs);

          setSendFeedback('✅ Message dispatched successfully!');
        } else {
          const errorMsg = data.error || `HTTP ${response.status}`;
          setChatMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED', error: errorMsg } : m))
          );
          setSendFeedback(`❌ Send failed: ${errorMsg}`);
        }
      } catch (err: any) {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED', error: err.message || 'Error' } : m))
        );
        setSendFeedback(`❌ Error: ${err.message || 'Network error'}`);
      } finally {
        setIsSending(false);
        setTimeout(() => setSendFeedback(null), 4000);
      }
    },
    [selectedPhone, accounts, activeThread?.name, onRecordsUpdated]
  );

  // Handle Simulate Inbound
  const handleSimulateInbound = () => {
    if (!simPhone.trim() || !simMessage.trim()) return;

    const phone = simPhone.trim();
    const newMsg: ChatMessage = {
      id: `sim_${Date.now()}`,
      phone,
      direction: 'incoming',
      text: simMessage.trim(),
      status: 'RECEIVED',
      timestamp: new Date().toISOString(),
      apiAccount: simDevice,
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setSelectedPhone(phone);
    setShowSimulateModal(false);
    setSendFeedback(`✅ Simulated incoming SMS from ${phone}`);
    setTimeout(() => setSendFeedback(null), 4000);
  };

  // Start New Chat
  const handleStartNewChat = () => {
    if (!newChatPhone.trim()) return;
    const phone = newChatPhone.trim();
    setSelectedPhone(phone);

    if (newChatName.trim()) {
      const currentRecs = loadRecords();
      const existing = currentRecs.find((r) => r.phone === phone);
      if (existing) {
        existing.name = newChatName.trim();
      } else {
        currentRecs.unshift({
          phone,
          name: newChatName.trim(),
          status: 'PENDING',
          attempts: 0,
          last_error: '',
          last_time: new Date().toISOString(),
          created_at: new Date().toISOString(),
          api_used: '',
          assigned_api: accounts[0]?.user || '',
          message_sent: '',
          auto_retry_count: 0,
        });
      }
      saveRecords(currentRecs);
      onRecordsUpdated(currentRecs);
    }

    setNewChatPhone('');
    setNewChatName('');
    setShowNewChatModal(false);
  };

  // Clear thread
  const handleClearThread = () => {
    if (!selectedPhone) return;
    if (confirm(`Clear chat history for ${selectedPhone}?`)) {
      setChatMessages((prev) => prev.filter((m) => m.phone !== selectedPhone));
    }
  };

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/sms/webhook`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Contact Chat & Message Box
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              Live Auto-Sync Active (3s)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Full contact conversation threads with real-time automatic mobile SMS webhook integration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setShowNewChatModal(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Chat</span>
          </button>

          <button
            onClick={() => fetchWebhookInbound(true)}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Force immediate check for new mobile SMS"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Sync Now</span>
          </button>

          <button
            onClick={() => setShowSimulateModal(true)}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Test sending an automatic incoming friend SMS to the webhook endpoint"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>⚡ Test Auto-Receive SMS</span>
          </button>

          <button
            onClick={() => setShowWebhookModal(true)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="View Webhook Endpoint URL for Android Mobile Forwarder setup"
          >
            <Radio className="w-4 h-4 text-emerald-500" />
            <span>📱 Mobile Gateway Setup</span>
          </button>
        </div>
      </div>

      {sendFeedback && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold rounded-xl flex items-center justify-between">
          <span>{sendFeedback}</span>
          <button onClick={() => setSendFeedback(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Filter and View Mode Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* View Mode Toggle */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold shrink-0">
          <button
            onClick={() => setViewMode('threads')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === 'threads'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            <span>💬 Conversations (By Contact)</span>
          </button>
          <button
            onClick={() => setViewMode('log')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === 'log'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-black'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>📋 All Messages Timeline ({allFilteredMessages.length})</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* API Account Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl">
            <Radio className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px] shrink-0">API Account:</span>
            <select
              value={selectedApiFilter}
              onChange={(e) => setSelectedApiFilter(e.target.value)}
              className="bg-transparent font-extrabold text-slate-800 dark:text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[150px] truncate"
            >
              <option value="all">🌐 All API Accounts</option>
              {uniqueApiAccounts.map((accUser) => (
                <option key={accUser} value={accUser}>
                  🔑 {accUser}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter phone or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {sendFeedback && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold rounded-xl flex items-center justify-between">
          <span>{sendFeedback}</span>
          <button onClick={() => setSendFeedback(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* VIEW MODE 1: Conversation Threads (By Contact) */}
      {viewMode === 'threads' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[700px]">
          {/* Left Column: Thread List */}
          <div
            className={`lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm ${
              selectedPhone ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-1 text-[11px] font-bold overflow-x-auto pb-1">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-extrabold'
                      : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All ({threadsByPhone.length})
                </button>
                <button
                  onClick={() => setFilterType('incoming')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    filterType === 'incoming'
                      ? 'bg-indigo-600 text-white font-extrabold'
                      : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  📥 Incoming ({threadsByPhone.filter((t) => t.hasIncoming).length})
                </button>
                <button
                  onClick={() => setFilterType('outgoing')}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    filterType === 'outgoing'
                      ? 'bg-emerald-600 text-white font-extrabold'
                      : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  📤 Outgoing
                </button>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60"
              onScroll={handleThreadScroll}
            >
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-xs font-semibold">No contacts match filter.</p>
                </div>
              ) : (
                <>
                  {displayedThreads.map((thread) => {
                    const isSelected = thread.phone === selectedPhone;
                    return (
                      <button
                        key={thread.phone}
                        onClick={() => setSelectedPhone(thread.phone)}
                        className={`w-full text-left p-3 transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                            thread.hasIncoming
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                          }`}
                        >
                          {thread.name ? thread.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {thread.name ? `${thread.name} (${thread.phone})` : thread.phone}
                            </h3>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {thread.lastMsg.direction === 'outgoing' ? 'You: ' : 'Received: '}
                            {thread.lastMsg.text}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {displayedThreads.length < filteredThreads.length && (
                    <div className="p-3 text-center border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => setVisibleThreadCount((prev) => Math.min(prev + 25, filteredThreads.length))}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
                      >
                        Load More Contacts ({filteredThreads.length - displayedThreads.length} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Column: Active Thread View */}
          <div
            className={`lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm ${
              !selectedPhone ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {activeThread ? (
              <>
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setSelectedPhone('')}
                      className="lg:hidden p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0">
                      {activeThread.name ? activeThread.name.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        {activeThread.name || activeThread.phone}
                        {activeThread.name && (
                          <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400 ml-1">
                            ({activeThread.phone})
                          </span>
                        )}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setSimPhone(activeThread.phone);
                        setSimMessage("Hey! Just saw your text from my phone.");
                        setShowSimulateModal(true);
                      }}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Test receiving an automatic SMS reply from this friend"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span className="hidden sm:inline">⚡ Auto-Receive Test</span>
                    </button>

                    {onNavigateToSend && (
                      <button
                        onClick={() => onNavigateToSend(activeThread.phone)}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Send Panel</span>
                      </button>
                    )}

                    <button
                      onClick={handleClearThread}
                      className="p-2 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      title="Clear history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Message List */}
                <div
                  className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 bg-slate-50/30 dark:bg-slate-950/30"
                  onScroll={handleActiveChatScroll}
                >
                  {activeThread.messages.length > displayedActiveMessages.length && (
                    <div className="text-center py-2 pb-3">
                      <button
                        onClick={() => setVisibleActiveMsgCount((prev) => Math.min(prev + 25, activeThread.messages.length))}
                        className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                      >
                        ⬆ Load older messages ({activeThread.messages.length - displayedActiveMessages.length} remaining)
                      </button>
                    </div>
                  )}
                  {displayedActiveMessages.map((msg, idx) => (
                    <MessageBubble
                      key={msg.id || idx}
                      msg={msg}
                      contactName={activeThread.name}
                      isOutgoing={msg.direction === 'outgoing'}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <ChatComposer
                  onSend={handleSendSMS}
                  accounts={accounts}
                  messageVariants={messageVariants}
                  isSending={isSending}
                  selectedPhone={activeThread.phone}
                  contactName={activeThread.name}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                <Smartphone className="w-12 h-12 opacity-20" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Select a Contact Conversation</h3>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: All Messages Log Timeline (By Phone or API) */}
      {viewMode === 'log' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Chronological Message Log ({allFilteredMessages.length} Messages)
            </h3>
            {selectedApiFilter !== 'all' && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                Filtered by API: {selectedApiFilter}
              </span>
            )}
          </div>

          <div className="overflow-x-auto max-h-[650px] overflow-y-auto" onScroll={handleLogScroll}>
            {allFilteredMessages.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Clock className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm font-bold">No messages found for this filter.</p>
              </div>
            ) : (
              <>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Direction</th>
                      <th className="p-3">Phone & Contact</th>
                      <th className="p-3">API Gateway Account</th>
                      <th className="p-3">Message Text</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedLogMessages.map((msg, i) => (
                      <tr key={msg.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                        <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(msg.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {msg.direction === 'outgoing' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                              📤 Outgoing
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              📥 Incoming
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {msg.contactName ? (
                            <div>
                              <div>{msg.contactName}</div>
                              <div className="text-[10px] font-mono font-normal text-slate-400">{msg.phone}</div>
                            </div>
                          ) : (
                            <span className="font-mono">{msg.phone}</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                            {msg.apiAccount || 'Gateway API'}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-slate-700 dark:text-slate-300" title={msg.text}>
                          {msg.text}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {msg.status === 'DELIVERED' && <span className="text-emerald-600 dark:text-emerald-400 font-bold">Delivered</span>}
                          {msg.status === 'SENT' && <span className="text-indigo-600 dark:text-indigo-400 font-bold">Dispatched</span>}
                          {msg.status === 'RECEIVED' && <span className="text-emerald-600 dark:text-emerald-400 font-bold">Received</span>}
                          {msg.status === 'FAILED' && <span className="text-rose-600 dark:text-rose-400 font-bold">Failed</span>}
                          {msg.status === 'PENDING' && <span className="text-amber-600 dark:text-amber-400 font-bold">Pending</span>}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedPhone(msg.phone);
                              setViewMode('threads');
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] rounded-lg transition-all"
                          >
                            Open Chat
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {displayedLogMessages.length < allFilteredMessages.length && (
                  <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setVisibleLogCount((prev) => Math.min(prev + 30, allFilteredMessages.length))}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      Load More Messages ({allFilteredMessages.length - displayedLogMessages.length} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-500" />
                Mobile SMS Webhook Endpoint
              </h3>
              <button onClick={() => setShowWebhookModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">×</button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                Configure your mobile SMS Forwarder app (e.g. <em>SMS Gateway</em>, <em>SMS Forwarder</em>, or <em>Tasker</em>) on your phone to POST to this Webhook URL for both <strong>Incoming SMS</strong> and <strong>Sent/Outgoing SMS</strong>:
              </p>

              <div className="p-3 bg-slate-950 rounded-xl font-mono text-xs text-emerald-400 flex items-center justify-between border border-slate-800">
                <span className="truncate mr-2 font-bold">{window.location.origin}/api/sms/webhook</span>
                <button onClick={copyWebhookUrl} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shrink-0">
                  {copiedWebhook ? 'Copied!' : 'Copy URL'}
                </button>
              </div>

              {/* Payload Instructions */}
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-[11px]">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Supported Event Payloads
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                  <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <span className="text-indigo-600 font-bold font-sans block mb-1">📤 Mobile Outgoing SMS:</span>
                    {`{"event": "sms_sent", "to": "+1234567890", "message": "Hi from phone", "account": "SIM 1"}`}
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                    <span className="text-emerald-600 font-bold font-sans block mb-1">📥 Mobile Incoming SMS:</span>
                    {`{"event": "sms_received", "from": "+1234567890", "message": "Reply text", "account": "SIM 1"}`}
                  </div>
                </div>
              </div>

              {/* Webhook Quick Test Form */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Test Webhook Sync Endpoint</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={testWebhookDir}
                    onChange={(e) => setTestWebhookDir(e.target.value as any)}
                    className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="outgoing">📤 Mobile Sent (Outgoing)</option>
                    <option value="incoming">📥 Mobile Received (Incoming)</option>
                  </select>
                  <input
                    type="text"
                    value={testWebhookPhone}
                    onChange={(e) => setTestWebhookPhone(e.target.value)}
                    placeholder="Contact phone"
                    className="sm:col-span-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <input
                  type="text"
                  value={testWebhookMsg}
                  onChange={(e) => setTestWebhookMsg(e.target.value)}
                  placeholder="Message content"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <button
                  onClick={handleTestWebhookPost}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Send Test Webhook POST
                </button>
              </div>
            </div>

            <button onClick={() => setShowWebhookModal(false)} className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Log Mobile Sent Modal */}
      {showLogMobileModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-500" />
                Log SMS Sent From Mobile
              </h3>
              <button onClick={() => setShowLogMobileModal(false)} className="text-slate-400 font-bold text-lg">×</button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Record a text message sent directly from your physical mobile phone into a contact's conversation thread.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Contact Phone Number:</label>
                <input
                  type="text"
                  value={mobileSentPhone}
                  onChange={(e) => setMobileSentPhone(e.target.value)}
                  placeholder="e.g. +1234567890"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Message Sent From Phone:</label>
                <textarea
                  rows={3}
                  value={mobileSentMessage}
                  onChange={(e) => setMobileSentMessage(e.target.value)}
                  placeholder="Type the message you sent from your phone..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">SIM / Device Label:</label>
                <input
                  type="text"
                  value={mobileSentAccount}
                  onChange={(e) => setMobileSentAccount(e.target.value)}
                  placeholder="e.g. My Phone SIM 1"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowLogMobileModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSaveMobileSentSMS} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm">
                Save to Chat Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Received SMS Modal */}
      {showLogReceivedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-500" />
                Log Received SMS / Friend Reply
              </h3>
              <button onClick={() => setShowLogReceivedModal(false)} className="text-slate-400 font-bold text-lg">×</button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Record an SMS reply you received on your physical mobile phone from a friend or client so it appears instantly in their conversation thread.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Friend's Phone Number:</label>
                <input
                  type="text"
                  value={logReceivedPhone}
                  onChange={(e) => setLogReceivedPhone(e.target.value)}
                  placeholder="e.g. +1234567890"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Friend's Name (Optional):</label>
                <input
                  type="text"
                  value={logReceivedSenderName}
                  onChange={(e) => setLogReceivedSenderName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Message Received on Mobile:</label>
                <textarea
                  rows={3}
                  value={logReceivedMessage}
                  onChange={(e) => setLogReceivedMessage(e.target.value)}
                  placeholder="Paste or type the text message your friend sent..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowLogReceivedModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSaveReceivedSMS} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm">
                Save Incoming SMS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Simulate Incoming SMS</h3>
              <button onClick={() => setShowSimulateModal(false)} className="text-slate-400 font-bold">×</button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
              />
              <textarea
                rows={3}
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="Message text"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSimulateModal(false)} className="px-4 py-2 bg-slate-200 text-xs font-bold rounded-xl">
                Cancel
              </button>
              <button onClick={handleSimulateInbound} className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl">
                Inject Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Start New Chat</h3>
              <button onClick={() => setShowNewChatModal(false)} className="text-slate-400 font-bold">×</button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                placeholder="Phone number e.g. +1234567890"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
              />
              <input
                type="text"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder="Contact Name (optional)"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewChatModal(false)} className="px-4 py-2 bg-slate-200 text-xs font-bold rounded-xl">
                Cancel
              </button>
              <button onClick={handleStartNewChat} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl">
                Open Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
