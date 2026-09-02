'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { api, describeError } from '@/lib/api';

/**
 * One agent, reachable from anywhere.
 *
 * The conversation used to live inside the corner panel, which meant the only
 * way to talk to HELM was to find the orb and type the question out. Nothing
 * else on the page could hand it a subject.
 *
 * Lifting the state here is what makes "ask about this number" possible: a
 * metric cell, a finding, a chart point can all call `ask()` with the thing
 * they are showing, and the console opens already pointed at it. The orb
 * becomes one caller among several rather than the owner of the feature.
 *
 * It stays client-side and per-session on purpose. A panel that remembered
 * last Tuesday would be a surprise rather than a feature, and holding it here
 * means the backend stays stateless — no API contract changes for any of this.
 */

export type AgentAction = { tool: string; summary: string; href?: string };

export type AgentTurn = {
  role: 'user' | 'assistant';
  content: string;
  actions?: AgentAction[];
  failed?: boolean;
  /** What was on screen when the question was asked, if anything. */
  subject?: string;
};

type AgentValue = {
  open: boolean;
  turns: AgentTurn[];
  thinking: boolean;
  draft: string;
  /** The thing the console is currently pointed at, shown as a chip. */
  subject: string | null;
  setDraft: (value: string) => void;
  setSubject: (subject: string | null) => void;
  openConsole: (subject?: string) => void;
  closeConsole: () => void;
  toggleConsole: () => void;
  clear: () => void;
  send: (text: string) => void;
  /** Open the console and ask in one motion. */
  ask: (question: string, subject?: string) => void;
};

const AgentContext = createContext<AgentValue | null>(null);

export function useAgent(): AgentValue {
  const value = useContext(AgentContext);
  if (!value) throw new Error('useAgent must be used inside <AgentProvider>');
  return value;
}

export function AgentProvider({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [subject, setSubject] = useState<string | null>(null);

  /*
   * A mirror of the thread.
   *
   * `send` is handed to memoised children, and rebuilding it on every turn
   * would rebuild them too. Reading the thread from a ref keeps the callback
   * stable for the life of the provider without ever sending a stale history.
   */
  const threadRef = useRef<AgentTurn[]>([]);
  useEffect(() => {
    threadRef.current = turns;
  }, [turns]);

  /*
   * The in-flight guard.
   *
   * It is a ref rather than the `thinking` state because the check has to be
   * synchronous and it has to be read outside a state updater. React calls
   * updaters twice under StrictMode, so guarding inside one would fire every
   * request to the agent twice in development.
   */
  const inFlight = useRef(false);

  /* Following a link the agent offered is an answer; the console steps aside. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      // A second question while the first is still running would interleave two
      // replies into one thread, so the input is held instead.
      if (!question || inFlight.current) return;

      const pointedAt = subject ?? undefined;
      const asked: AgentTurn = { role: 'user', content: question, subject: pointedAt };
      const history = [...threadRef.current, asked];

      inFlight.current = true;
      threadRef.current = history;
      setTurns(history);
      setDraft('');
      setThinking(true);

      void (async () => {
        try {
          const response = await api.post<{ reply: string; actions: AgentAction[] }>(
            `/api/workspaces/${workspaceSlug}/agent`,
            {
              messages: history.map(({ role, content, subject: on }) => ({
                role,
                // The subject rides in the message text rather than in a new
                // field, because the backend contract is not ours to change.
                content: on ? `About ${on}: ${content}` : content,
              })),
            },
          );
          setTurns((current) => [
            ...current,
            { role: 'assistant', content: response.reply, actions: response.actions },
          ]);
        } catch (error) {
          setTurns((current) => [
            ...current,
            { role: 'assistant', content: describeError(error), failed: true },
          ]);
        } finally {
          inFlight.current = false;
          setThinking(false);
        }
      })();
    },
    [subject, workspaceSlug],
  );

  const openConsole = useCallback((on?: string) => {
    if (on !== undefined) setSubject(on);
    setOpen(true);
  }, []);

  const closeConsole = useCallback(() => setOpen(false), []);
  const toggleConsole = useCallback(() => setOpen((value) => !value), []);

  const clear = useCallback(() => {
    threadRef.current = [];
    setTurns([]);
    setSubject(null);
  }, []);

  const ask = useCallback(
    (question: string, on?: string) => {
      if (on !== undefined) setSubject(on);
      setOpen(true);
      send(question);
    },
    [send],
  );

  const value = useMemo<AgentValue>(
    () => ({
      open,
      turns,
      thinking,
      draft,
      subject,
      setDraft,
      setSubject,
      openConsole,
      closeConsole,
      toggleConsole,
      clear,
      send,
      ask,
    }),
    [open, turns, thinking, draft, subject, openConsole, closeConsole, toggleConsole, clear, send, ask],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
