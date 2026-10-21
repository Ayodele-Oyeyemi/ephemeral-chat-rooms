import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Clipboard,
  Hash,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const AVATARS = ["#a78bfa", "#67e8f9", "#fda4af", "#fcd34d", "#86efac", "#fdba74"];
const ADJECTIVES = ["Bright", "Cosmic", "Mellow", "Silver", "Lucky", "Swift"];
const ANIMALS = ["Fox", "Otter", "Comet", "Robin", "Panda", "Koala"];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getIdentity() {
  let participantId = sessionStorage.getItem("gather-participant-id");
  let displayName = sessionStorage.getItem("gather-display-name");
  if (!participantId) {
    participantId = crypto.randomUUID();
    displayName = `${randomItem(ADJECTIVES)} ${randomItem(ANIMALS)}`;
    sessionStorage.setItem("gather-participant-id", participantId);
    sessionStorage.setItem("gather-display-name", displayName);
  }
  return { participantId, displayName };
}

function App() {
  const socket = useMemo(() => io(SERVER_URL, { autoConnect: false }), []);
  const [identity] = useState(getIdentity);
  const [room, setRoom] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const joinedCode = useRef("");

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      if (room && joinedCode.current !== room.roomCode) {
        joinedCode.current = room.roomCode;
        socket.emit("join_room", { ...room, ...identity });
      }
    };
    const onDisconnect = () => {
      setConnected(false);
      joinedCode.current = "";
    };
    const onRoomState = (state) => setRoomState(state);
    const onMessage = (message) => {
      setRoomState((current) => current
        ? { ...current, messages: [...current.messages, message] }
        : current);
    };
    const onPoll = (poll) => {
      setRoomState((current) => current ? { ...current, poll } : current);
    };
    const onRoomError = ({ message }) => setError(message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_state", onRoomState);
    socket.on("message_received", onMessage);
    socket.on("poll_updated", onPoll);
    socket.on("room_error", onRoomError);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_state", onRoomState);
      socket.off("message_received", onMessage);
      socket.off("poll_updated", onPoll);
      socket.off("room_error", onRoomError);
      socket.disconnect();
    };
  }, [identity, room, socket]);

  async function createRoom(name) {
    setError("");
    try {
      const response = await fetch(`${SERVER_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create a room.");
      setRoom(result);
      setRoomState(null);
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the chat server.");
    }
  }

  function joinRoom(roomCode) {
    const code = roomCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      setError("Enter a valid 5-character room code.");
      return;
    }
    setError("");
    setRoom({ roomCode: code });
    setRoomState(null);
  }

  function leaveRoom() {
    socket.emit("leave_room");
    joinedCode.current = "";
    setRoom(null);
    setRoomState(null);
    setActiveTab("chat");
  }

  async function shareRoom() {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the room code. You can copy it from the header.");
    }
  }

  if (!room) {
    return <Landing onCreate={createRoom} onJoin={joinRoom} error={error} connected={connected} />;
  }
  if (!roomState) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="text-center">
          {error ? (
            <>
              <p className="text-sm text-rose-300">{error}</p>
              <button onClick={leaveRoom} className="secondary-button mt-4">Back to home</button>
            </>
          ) : (
            <div className="flex items-center gap-3 text-slate-300">
              <LoaderCircle className="animate-spin text-violet" size={20} />
              Joining room {room.roomCode}…
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={leaveRoom} className="icon-button" aria-label="Back to home">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-white">{roomState.name}</h1>
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
              </div>
              <p className="mt-0.5 text-xs text-slate-400">Your room · messages disappear when it expires</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={shareRoom} className="secondary-button">
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? "Copied" : "Share"}
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">{roomState.roomCode}</span>
            </button>
            <button onClick={leaveRoom} className="text-button">Leave room</button>
          </div>
        </header>

        <section className="flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/80 shadow-2xl shadow-black/20">
          <div className="flex border-b border-white/[0.08] px-4 sm:px-6">
            <TabButton active={activeTab === "chat"} onClick={() => setActiveTab("chat")} icon={<MessageCircle size={16} />}>
              Live chat
            </TabButton>
            <TabButton active={activeTab === "poll"} onClick={() => setActiveTab("poll")} icon={<Vote size={16} />}>
              Live poll
            </TabButton>
          </div>
          {activeTab === "chat" ? (
            <Chat roomState={roomState} identity={identity} socket={socket} />
          ) : (
            <Poll roomState={roomState} identity={identity} socket={socket} />
          )}
        </section>
        {error && <p className="mt-3 text-center text-sm text-rose-300">{error}</p>}
      </div>
    </main>
  );
}

function Landing({ onCreate, onJoin, error, connected }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  function submitCreate(event) {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    Promise.resolve(onCreate(name.trim())).finally(() => setCreating(false));
  }

  function submitJoin(event) {
    event.preventDefault();
    onJoin(code);
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div className="glow glow-one" />
      <div className="glow glow-two" />
      <div className="relative w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-violet/30 bg-violet/10 text-violet shadow-lg shadow-violet/10">
            <Sparkles size={26} />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-violet">Gather together</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">A room for right now.</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-400">
            Drop in, share a thought, and make a decision. No accounts, no history—just your people.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.09] bg-panel/90 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <form onSubmit={submitCreate}>
            <label htmlFor="room-name" className="mb-2 block text-sm font-medium text-slate-200">Start a new room</label>
            <div className="flex gap-2">
              <input
                id="room-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder="e.g. Friday plans"
                className="text-input min-w-0 flex-1"
              />
              <button className="primary-button shrink-0" disabled={!name.trim() || creating}>
                {creating ? <LoaderCircle className="animate-spin" size={17} /> : <Plus size={17} />}
                Create
              </button>
            </div>
          </form>

          <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-slate-600">
            <div className="h-px flex-1 bg-white/[0.08]" />or join a room<div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <form onSubmit={submitJoin}>
            <label htmlFor="room-code" className="mb-2 block text-sm font-medium text-slate-200">Room code</label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                <input
                  id="room-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                  placeholder="ABCDE"
                  maxLength={5}
                  className="text-input w-full pl-10 font-mono uppercase tracking-[0.2em]"
                />
              </div>
              <button className="secondary-button shrink-0" disabled={code.length !== 5}>Join room</button>
            </div>
          </form>
          {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
            {connected ? "Ready when you are" : "Connecting to room server…"}
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-slate-600">Rooms are temporary and expire after 30 minutes of inactivity.</p>
      </div>
    </main>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick} className={`tab-button ${active ? "tab-button-active" : ""}`}>
      {icon}{children}
    </button>
  );
}

function Chat({ roomState, identity, socket }) {
  const [text, setText] = useState("");
  const bottomAnchor = useRef(null);

  useEffect(() => {
    bottomAnchor.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomState.messages]);

  function sendMessage(event) {
    event.preventDefault();
    if (!text.trim()) return;
    socket.emit("send_message", { text: text.trim(), sender: identity.displayName });
    setText("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 text-xs text-slate-500 sm:px-7">
        <span className="flex items-center gap-2"><Users size={14} />Room conversation</span>
        <span>{roomState.messages.length} {roomState.messages.length === 1 ? "message" : "messages"}</span>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-8">
        {roomState.messages.length === 0 ? (
          <div className="grid h-full min-h-64 place-items-center">
            <div className="max-w-xs text-center">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] text-slate-500"><MessageCircle size={19} /></div>
              <p className="text-sm font-medium text-slate-300">The room is all yours</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Say hello and get the conversation started.</p>
            </div>
          </div>
        ) : roomState.messages.map((message) => (
          <Message key={message.id} message={message} own={message.sender === identity.displayName} />
        ))}
        <div ref={bottomAnchor} />
      </div>
      <form onSubmit={sendMessage} className="border-t border-white/[0.08] p-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-black/20 p-1.5 pl-4 focus-within:border-violet/50">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            placeholder={`Message as ${identity.displayName}…`}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-slate-600"
          />
          <button className="send-button" disabled={!text.trim()} aria-label="Send message"><Send size={17} /></button>
        </div>
      </form>
    </div>
  );
}

function Message({ message, own }) {
  const avatarColor = AVATARS[(message.sender?.length || 0) % AVATARS.length];
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <article className={`flex gap-3 ${own ? "flex-row-reverse" : ""}`}>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-slate-950" style={{ backgroundColor: avatarColor }}>
        {(message.sender || "?").slice(0, 1)}
      </div>
      <div className={`max-w-[80%] ${own ? "text-right" : ""}`}>
        <div className={`mb-1 flex items-center gap-2 text-[11px] ${own ? "justify-end" : ""}`}>
          <span className="font-medium text-slate-300">{message.sender}</span>
          <time className="text-slate-600">{time}</time>
        </div>
        <p className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${own ? "rounded-tr-sm bg-violet/20 text-violet-50" : "rounded-tl-sm bg-white/[0.06] text-slate-200"}`}>
          {message.text}
        </p>
      </div>
    </article>
  );
}

function Poll({ roomState, identity, socket }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const poll = roomState.poll;
  const hasVoted = poll?.votedUsers.includes(identity.participantId) ?? false;
  const totalVotes = poll?.options.reduce((total, option) => total + option.votes, 0) ?? 0;

  function updateOption(index, value) {
    setOptions((current) => current.map((option, currentIndex) => currentIndex === index ? value : option));
  }

  function createPoll(event) {
    event.preventDefault();
    socket.emit("create_poll", { question: question.trim(), options: options.map((option) => option.trim()).filter(Boolean) });
    setQuestion("");
    setOptions(["", ""]);
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8">
      {!poll ? (
        <div className="mx-auto max-w-xl">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-violet/10 text-violet"><Vote size={20} /></div>
            <h2 className="text-lg font-semibold text-white">Make a decision together</h2>
            <p className="mt-1 text-sm text-slate-500">Create a poll and see votes appear live.</p>
          </div>
          <form onSubmit={createPoll} className="space-y-4 rounded-xl border border-white/[0.08] bg-black/10 p-5 sm:p-6">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-slate-300">Your question</span>
              <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={240} placeholder="Where should we go?" className="text-input w-full" />
            </label>
            <div>
              <span className="mb-2 block text-xs font-medium text-slate-300">Options</span>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <input key={index} value={option} onChange={(event) => updateOption(index, event.target.value)} maxLength={100} placeholder={`Option ${index + 1}`} className="text-input w-full" />
                ))}
              </div>
              {options.length < 8 && (
                <button type="button" onClick={() => setOptions((current) => [...current, ""])} className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                  <Plus size={14} />Add option
                </button>
              )}
            </div>
            <button className="primary-button w-full justify-center" disabled={!question.trim() || options.filter((option) => option.trim()).length < 2}>
              <Plus size={16} />Create poll
            </button>
          </form>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-violet/10 px-2.5 py-1 text-[11px] font-medium text-violet"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet" />Live poll</span>
              <h2 className="text-xl font-semibold leading-snug text-white sm:text-2xl">{poll.question}</h2>
            </div>
            <span className="shrink-0 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-400">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</span>
          </div>
          <div className="space-y-3">
            {poll.options.map((option) => {
              const percentage = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0;
              return (
                <button
                  key={option.id}
                  onClick={() => socket.emit("vote_poll", { optionId: option.id })}
                  disabled={hasVoted}
                  className={`poll-option ${hasVoted ? "cursor-default" : "hover:border-violet/40 hover:bg-white/[0.04]"}`}
                >
                  <div className="absolute inset-y-0 left-0 rounded-xl bg-violet/[0.12] transition-all duration-500" style={{ width: `${percentage}%` }} />
                  <div className="relative flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                      {hasVoted && <span className="grid h-4 w-4 place-items-center rounded-full bg-violet text-night"><Check size={11} /></span>}
                      {option.text}
                    </span>
                    <span className="text-xs tabular-nums text-slate-400">{percentage}% <span className="ml-1 text-slate-600">({option.votes})</span></span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
            <CircleHelp size={14} />{hasVoted ? "Your vote is in. Results update live." : "Choose an option to cast your vote."}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
