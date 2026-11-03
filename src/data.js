export const EMOJIS = [
  // Love reactions
  '❤️', '🩷', '💗', '💖', '💘', '💝', '💞', '💕', '💓', '💟',
  '❤️‍🔥', '❤️‍🩹', '💌', '💋', '😘', '🥰', '😍', '🫶', '💏', '💑',
  '💍', '💐', '🌹', '🌷', '🌸', '🌺', '🌻', '🌼', '🪷', '🪻',

  // Cute couple faces
  '😊', '🥹', '🥺', '😂', '🤣', '😅', '😇', '😉', '😌', '😍',
  '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '🤭', '🫣', '🙈',
  '🙉', '🙊', '🤗', '🫂', '😻', '😽', '😺', '😸', '😹', '😿',
  '😭', '🥲', '😴', '😪', '🤤', '😎', '🤩', '🥳', '😏', '😳',
  '😶‍🌫️', '🫠', '😮‍💨', '😔', '😢', '😡', '🤔', '🤫', '🫡', '🤤',

  // Hearts
  '💜', '💙', '🩵', '💚', '💛', '🧡', '🤎', '🖤', '🩶', '🤍',
  '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
  '💌', '💋', '🫀', '💑', '💏', '💒', '💍', '♾️', '💯', '💫',
  '✨', '⭐', '🌟', '💥', '💦', '💨', '🔥', '❤️‍🔥', '❤️‍🩹', '🫰',

  // Hugs and affection
  '🤗', '🫂', '🫶', '👐', '🤲', '🙏', '👏', '🙌', '🤝', '💋',
  '😘', '🥰', '😍', '💏', '💑', '👩‍❤️‍👨', '👨‍❤️‍👨', '👩‍❤️‍👩',
  '👩‍❤️‍💋‍👨', '👨‍❤️‍💋‍👨', '👩‍❤️‍💋‍👩',

  // Romantic gifts and flowers
  '🌹', '🌷', '🌸', '💐', '💮', '🪷', '🪻', '🌺', '🌻', '🌼',
  '🎁', '🎀', '💝', '💎', '💍', '🧸', '🐻', '🐼', '🐰', '🐱',
  '🍫', '🍬', '🍭', '🍰', '🧁', '🎂', '🍓', '🍒', '🍑', '🍯',

  // Couple activities and cozy moments
  '🌙', '🌛', '🌜', '🌚', '🌝', '⭐', '🌟', '🌌', '🌈', '☀️',
  '🌤️', '🌧️', '⛈️', '❄️', '☔', '☕', '🍵', '🥂', '🍿', '🎬',
  '🎶', '🎵', '🎧', '🎤', '🎸', '📸', '🏠', '🛏️', '🕯️', '🧺',
  '🚗', '✈️', '🏖️', '🌊', '🏕️', '🎡', '🎠', '🎢', '🎮', '🎨',

  // Chat and communication
  '💬', '🗨️', '🗯️', '💭', '📩', '📨', '📧', '💌', '📮', '📬',
  '📱', '📲', '☎️', '📞', '📟', '📠', '🎙️', '🎤', '🎧', '🔔',
  '🔕', '🔊', '🔇', '📢', '📣', '💻', '🖥️', '⌨️', '📝', '✍️',

  // Voice and video calls
  '📞', '📱', '🎥', '📹', '📷', '🎦', '🎙️', '🎧', '🔊', '🔉',
  '🔈', '🔇', '📡', '🛜', '🔋', '🔌', '⏰', '⏳', '⌛', '🕐',

  // Fun and playful
  '😂', '🤣', '😜', '🤪', '😝', '😆', '😹', '😻', '🙃', '😈',
  '👻', '💀', '🤡', '👽', '🤖', '💩', '🐸', '🦄', '🐣', '🐥',
  '🦋', '🐝', '🐞', '🐢', '🐬', '🦩', '🦢', '🐾', '🍀', '🌿',

  // Celebration and special moments
  '🎉', '🎊', '🥳', '🎈', '🎁', '🏆', '🥇', '🎖️', '🎀', '🪄',
  '🎇', '🎆', '🧨', '🪅', '🎵', '🎶', '💃', '🕺', '👑', '💫',

  // Gestures
  '👋', '🤚', '✋', '🖐️', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
  '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊',
  '👊', '🤛', '🤜', '💪', '🫶', '🫰', '🖖', '🤝', '🙏', '👏',

  // Symbols and extras
  '✅', '❌', '⭕', '❗', '❓', '‼️', '⁉️', '💯', '🔞', '♾️',
  '➕', '➖', '✖️', '➗', '✔️', '☑️', '🔒', '🔓', '🔑', '🗝️',
];

export const QUICK_NOTES = ['Hello ', 'Call me ✨ ', 'Good Night 🌙', 'Good Morning ✨', ' I miss you 🥺'];

export function formatTime(t) {
  const d = new Date(t);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayLabel(t) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(t)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(t).toDateString();
}

// "YYYY-MM-DD" -> whole days since that date, or null if missing or in the future.
export function daysTogether(dateStr) {
  if (!dateStr) return null;
  const start = new Date(`${dateStr}T00:00:00`).getTime();
  if (Number.isNaN(start)) return null;
  const days = Math.floor((Date.now() - start) / 86400000);
  return days >= 0 ? days : null;
}
