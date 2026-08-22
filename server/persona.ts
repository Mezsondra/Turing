/**
 * Per-match randomness for the AI opponent.
 *
 * Without this every AI round reads identically, so a player learns the bot's
 * voice after a handful of games and the guessing stops being a guess. Each
 * match composes a fresh person: who they are, what mood they are in, and how
 * they type.
 */

const NAMES = ['alex', 'sam', 'jordan', 'casey', 'mert', 'deniz', 'riley', 'emre', 'noah', 'zeynep', 'liam', 'ada'];

const SITUATIONS = [
  'on a break at work, bored',
  'lying in bed, cant sleep',
  'on the bus home',
  'meant to be studying and procrastinating',
  'waiting for food to arrive',
  'at your desk pretending to work',
  'just got in from the gym',
  'watching something half-heartedly in the background',
  'killing time before a meeting',
  'up too late scrolling',
];

const OCCUPATIONS = [
  'work in a warehouse', 'do admin at a dentist', 'study engineering', 'work retail',
  'do freelance design', 'work in a call centre', 'are a nurse on shifts',
  'study law and hate it', 'work in a kitchen', 'do something boring in insurance',
];

const MOODS = [
  'mildly bored but willing to chat',
  'a bit grumpy today, short with people',
  'chatty and nosy, ask things back',
  'distracted, half paying attention',
  'in a good mood, slightly playful',
  'tired and low energy, minimal effort',
  'suspicious that THEY might be the bot',
];

const STYLES = [
  'all lowercase, barely any punctuation',
  'lowercase but you do use commas and full stops',
  'you Capitalise your sentences properly, it is just how you type',
  'lots of short fragments. often two messages in a row',
  'you type in longer run on sentences without much punctuation',
  'very terse. one to three words a lot of the time',
];

const QUIRKS = [
  'you say "lol" a lot, maybe too much',
  'you never use emoji at all',
  'you use "haha" instead of "lol"',
  'you trail off with "..." fairly often',
  'you ask short follow up questions like "why" or "how come"',
  'you abbreviate heavily: u, ur, rn, ngl, tbh',
  'you occasionally send a single "?" when confused',
  'you swear mildly when something is funny or annoying',
];

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export interface Persona {
  /** Appended to the configured system prompt. */
  instruction: string;
  /** True if this opponent opens the conversation rather than waiting. */
  opensConversation: boolean;
  /** Chance this opponent splits a reply into two messages. */
  burstChance: number;
  /** Chance of simply not answering a message. Zero for attentive people. */
  ignoreChance: number;
  /** Chance of drifting off mid-conversation and replying late. */
  distractionChance: number;
}

const personas = new Map<string, Persona>();
const ignoresUsed = new Map<string, number>();
const incomingCounts = new Map<string, number>();

export function personaFor(matchId: string): Persona {
  let persona = personas.get(matchId);
  if (persona) return persona;

  const instruction = [
    '',
    'THIS CONVERSATION',
    `Your name is ${pick(NAMES)} if asked. You ${pick(OCCUPATIONS)}.`,
    `Right now you are ${pick(SITUATIONS)}.`,
    `Your mood: ${pick(MOODS)}.`,
    `Your typing: ${pick(STYLES)}.`,
    `A habit of yours: ${pick(QUIRKS)}`,
    'Stay consistent with all of this for the whole conversation. Do not announce any of it.',
  ].join('\n');

  persona = {
    instruction,
    // A real partner does not always message first. When the AI always opens,
    // "did they speak first?" becomes a perfect tell.
    opensConversation: Math.random() < 0.55,
    burstChance: Math.random() < 0.4 ? 0.35 : 0,
    // Roughly a third of people are half-paying-attention. The rest reply to
    // everything, which is fine - it is the uniformity that gives a bot away,
    // not attentiveness itself.
    ...(Math.random() < 0.35
      ? { ignoreChance: 0.25, distractionChance: 0.3 }
      : { ignoreChance: 0, distractionChance: 0.08 }),
  };

  personas.set(matchId, persona);
  return persona;
}

/** Counts what the player has sent in this match, and returns the new total. */
export function noteIncoming(matchId: string): number {
  const count = (incomingCounts.get(matchId) ?? 0) + 1;
  incomingCounts.set(matchId, count);
  return count;
}

/**
 * Whether this opponent simply does not answer this message.
 *
 * A bot that replies to every single message is uniform in a way people are
 * not. Bounded hard: never the player's opening message, and at most once per
 * match - beyond that it stops being characterful and starts being broken.
 */
export function shouldIgnoreMessage(matchId: string, incomingIndex: number): boolean {
  const { ignoreChance } = personaFor(matchId);
  if (!ignoreChance) return false;
  if (incomingIndex <= 1) return false;
  if ((ignoresUsed.get(matchId) ?? 0) >= 1) return false;
  if (Math.random() > ignoreChance) return false;

  ignoresUsed.set(matchId, 1);
  return true;
}

/** Extra pause when someone's attention wanders mid-conversation. */
export function distractionPauseMs(matchId: string): number {
  const { distractionChance } = personaFor(matchId);
  return Math.random() < distractionChance ? 4000 + Math.random() * 6000 : 0;
}

export function forgetPersona(matchId: string): void {
  personas.delete(matchId);
  ignoresUsed.delete(matchId);
  incomingCounts.delete(matchId);
}
