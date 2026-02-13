import type { SessionStatus } from "./minionUtils"

export interface PersonalityMessages {
  active: string[]
  idle: string[]
  supervising: string[]
  sleeping: string[]
  working: string[]
  thinking: string[]
}

const MAIN_AGENT_MESSAGES: PersonalityMessages = {
  active: ["Hard at work! 💪", "On it, boss! 🦞", "Processing... ⚡", "Making magic happen ✨", "Crushing tasks 🔨"],
  idle: ["Standing by... 🎯", "Ready when you are! 👍", "Waiting for orders 📋", "Just chilling 😎", "Coffee break? ☕"],
  supervising: ["Watching over the crew 👁️", "Delegating like a boss 📋", "Team lead mode 🎯", "Subagent at work! 🤝", "Managing the troops 🦞"],
  sleeping: ["Zzz... 💤", "Taking a nap 😴", "Recharging 🔋", "Dreaming of code 💭", "Sleeping 🪵"],
  working: ["Getting my hands dirty 🔧", "Diving into code 🏊", "Building 🏗️", "Problem-solving 🧠", "In the zone! 🎯"],
  thinking: ["Hmm, let me think... 🤔", "Brain at 110%! 🧠", "Pondering 💭", "Thinking deeply... 🌊", "Computing... ⚙️"],
}

const CRON_WORKER_MESSAGES: PersonalityMessages = {
  active: ["Right on schedule! ⏰", "Punctual as always ⏱️", "Tick tock 🕐", "On time ✅", "Scheduled perfection 📅"],
  idle: ["Waiting for my cue ⏳", "Next run soon... 🔜", "Patience ⏸️", "Alarm set! ⏰", "Counting down... ⏲️"],
  supervising: ["Spawned a helper ⚡", "Task delegated ⏱️", "Worker dispatched 📤", "Subagent running 🔄", "Overseeing task ⏰"],
  sleeping: ["Between shifts 💤", "Off the clock 🛌", "Next shift later ⏰", "Resting 😴", "Scheduled downtime 🌙"],
  working: ["Running task 📋", "Doing my routine 🔄", "Clockwork precision ⚙️", "Another day 📆", "Reliability ✅"],
  thinking: ["Calculating ⏱️", "Planning ahead 📅", "Timing is everything ⏰", "Strategizing... 🎯", "Scheduling 💭"],
}

const CHAT_BOT_MESSAGES: PersonalityMessages = {
  active: ["Chatting away! 💬", "Messages incoming! 📱", "Connected 🔗", "Social butterfly 🦋", "Conversation going 💭"],
  idle: ["Inbox empty! 📭", "Waiting for messages 📱", "Nobody texting? 😢", "Ready to chat! 💬", "Silence... 🤐"],
  supervising: ["Helper on the case 🤝", "Subagent replying 💬", "Delegated! 📋", "Team effort 👥", "Assistant assisting 🦸"],
  sleeping: ["Do not disturb 🔕", "AFK 💤", "Offline 📵", "Phone off 📴", "Silent hours 🌙"],
  working: ["Replying 📝", "Updating folks 📢", "Communication central! 📡", "Spreading the word 📣", "Chat master 💬"],
  thinking: ["Crafting response 📝", "What should I say? 🤔", "Choosing words 💭", "Thinking before texting 💬", "Formulating... ⌨️"],
}

const SUBAGENT_MESSAGES: PersonalityMessages = {
  active: ["Quick task mode! ⚡", "Speed is my game 🏃", "Fast and efficient! 🚀", "Helping out! 🤝", "Sub-in ready! 🎯"],
  idle: ["On standby 🎯", "Ready to assist! 🤝", "Waiting to help ✋", "Helper mode 🦸", "At your service! 🙇"],
  supervising: ["Sub-ception! 🤯", "Delegating further 📋", "Chain of command 🔗", "Recursive helping 🔄", "Meta-assist! ⚡"],
  sleeping: ["Mission complete 💤", "Task done 😴", "Standing down 🛌", "Helper sleeping 🌙", "Powered down ⚡"],
  working: ["Helping main agent 🤝", "Quick assist! ⚡", "Teamwork 🎯", "Lending a hand 👋", "Sub power! 💪"],
  thinking: ["Quick thinking! ⚡", "Rapid processing 🧠", "Fast calculations 🔢", "Speed thinking 💭", "Quick decision ⏱️"],
}

const DEFAULT_MESSAGES: PersonalityMessages = {
  active: ["Working... 🤖", "Processing... ⚙️", "Active now ✅", "On the job 💼", "Busy mode 🔄"],
  idle: ["Idle... ⏸️", "Waiting... ⏳", "Standby 🎯", "Ready ✋", "On call 📞"],
  supervising: ["Overseeing work 👁️", "Watching subagent 🔍", "Delegated task 📋", "Managing helper 🤝", "Supervising... 👀"],
  sleeping: ["Sleeping... 💤", "Offline 😴", "Powered down 🔌", "Resting 🛌", "Inactive 🌙"],
  working: ["Processing task 📋", "Working 🔧", "In progress... ⚙️", "Doing the thing 💪", "Task mode 🎯"],
  thinking: ["Thinking... 💭", "Processing... 🧠", "Calculating... ⚙️", "Computing... 💻", "Analyzing... 🔍"],
}

export function getPersonalityMessages(minionType: string): PersonalityMessages {
  switch (minionType) {
    case "Main Agent": return MAIN_AGENT_MESSAGES
    case "Cron Worker": return CRON_WORKER_MESSAGES
    case "WhatsApp Bot":
    case "Slack Bot":
    case "Telegram Bot": return CHAT_BOT_MESSAGES
    case "Subagent": return SUBAGENT_MESSAGES
    default: return DEFAULT_MESSAGES
  }
}

export function getRandomMessage(minionType: string, category: keyof PersonalityMessages): string {
  const messages = getPersonalityMessages(minionType)
  const categoryMessages = messages[category]
  return categoryMessages[Math.floor(Math.random() * categoryMessages.length)]
}

export function getPersonalityStatus(minionType: string, status: SessionStatus, isWorking?: boolean, isThinking?: boolean): string {
  if (isThinking) return getRandomMessage(minionType, "thinking")
  if (isWorking) return getRandomMessage(minionType, "working")
  return getRandomMessage(minionType, status)
}
