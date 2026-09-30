const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ==================== STORAGE & PROGRESS ====================
const STORAGE_KEY = 'mathFunKids_v1';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    selectedGrade: null,
    stars: 0,
    badges: [],
    topics: {},
    history: [],
    settings: { audio: true, reducedMotion: false },
    lastDaily: null,
    dailyStreak: 0
  };
}

function saveProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

// ==================== AUDIO (Web Speech) ====================
function speak(text, enabled = true) {
  if (!enabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1.1;
  u.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google')));
  if (preferred) u.voice = preferred;
  window.speechSynthesis.speak(u);
}

// ==================== QUESTION GENERATORS ====================
const EMOJIS = {
  apple: '🍎', dog: '🐶', star: '⭐', ball: '⚽', cat: '🐱',
  flower: '🌸', fish: '🐟', car: '🚗', book: '📚', cookie: '🍪',
  balloon: '🎈', heart: '❤️', sun: '☀️', moon: '🌙', tree: '🌳'
};
const EMOJI_LIST = Object.values(EMOJIS);

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickEmoji() {
  return EMOJI_LIST[randInt(0, EMOJI_LIST.length - 1)];
}

function genKGNumberRecognition(diff = 1) {
  const max = diff === 1 ? 10 : diff === 2 ? 15 : 20;
  const correct = randInt(0, max);
  const options = new Set([correct]);
  while (options.size < 4) {
    options.add(randInt(0, max));
  }
  return {
    type: 'number-recognition',
    grade: 'kindergarten',
    topic: 'numbers',
    difficulty: diff,
    prompt: `Which number is ${correct}?`,
    speak: `Which number is ${correct}?`,
    correctAnswer: correct,
    options: shuffle([...options]),
    visual: null
  };
}

function genKGCounting(diff = 1) {
  const max = diff === 1 ? 5 : diff === 2 ? 10 : 15;
  const count = randInt(1, max);
  const emoji = pickEmoji();
  const options = new Set([count]);
  while (options.size < 4) {
    const o = randInt(1, max + 2);
    if (o !== count) options.add(o);
  }
  return {
    type: 'counting',
    grade: 'kindergarten',
    topic: 'counting',
    difficulty: diff,
    prompt: 'How many?',
    speak: `How many are there?`,
    correctAnswer: count,
    options: shuffle([...options]),
    visual: { emoji, count }
  };
}

function genKGAddition(diff = 1) {
  const max = diff === 1 ? 3 : diff === 2 ? 4 : 5;
  const a = randInt(1, max);
  const b = randInt(1, Math.max(1, max - a + 1));
  const sum = a + b;
  const emoji = pickEmoji();
  const options = new Set([sum]);
  while (options.size < 4) {
    options.add(randInt(1, max * 2 + 1));
  }
  return {
    type: 'visual-addition',
    grade: 'kindergarten',
    topic: 'addition',
    difficulty: diff,
    prompt: `What is ${a} + ${b}?`,
    speak: `What is ${a} plus ${b}?`,
    correctAnswer: sum,
    options: shuffle([...options]),
    visual: { emoji, a, b, sum }
  };
}

function genKGSubtraction(diff = 1) {
  const max = diff === 1 ? 4 : 5;
  const total = randInt(2, max);
  const take = randInt(1, total - 1);
  const left = total - take;
  const emoji = pickEmoji();
  const options = new Set([left]);
  while (options.size < 4) {
    options.add(randInt(0, max));
  }
  return {
    type: 'visual-subtraction',
    grade: 'kindergarten',
    topic: 'subtraction',
    difficulty: diff,
    prompt: `How many left?`,
    speak: `There are ${total}. Take away ${take}. How many are left?`,
    correctAnswer: left,
    options: shuffle([...options]),
    visual: { emoji, total, take, left }
  };
}

function genKGShapes(diff = 1) {
  const shapes2d = [
    { name: 'circle', emoji: '⭕', color: 'bg-red-400' },
    { name: 'square', emoji: '🟥', color: 'bg-blue-400' },
    { name: 'triangle', emoji: '🔺', color: 'bg-green-400' },
    { name: 'rectangle', emoji: '🟦', color: 'bg-yellow-400' }
  ];
  const shapes3d = [
    { name: 'sphere', emoji: '🔵', color: 'bg-purple-400' },
    { name: 'cube', emoji: '🧊', color: 'bg-pink-400' }
  ];
  const pool = diff >= 3 ? [...shapes2d, ...shapes3d] : shapes2d;
  const correct = pool[randInt(0, pool.length - 1)];
  let options = shuffle(pool).slice(0, 4);
  if (!options.find(o => o.name === correct.name)) options[0] = correct;
  options = shuffle(options);
  return {
    type: 'shapes',
    grade: 'kindergarten',
    topic: 'shapes',
    difficulty: diff,
    prompt: `Find the ${correct.name}`,
    speak: `Find the ${correct.name}`,
    correctAnswer: correct.name,
    options: options,
    visual: { target: correct }
  };
}

function genKGMissingNumber(diff = 1) {
  const max = diff === 1 ? 10 : 20;
  const start = randInt(0, max - 4);
  const seq = [start, start + 1, start + 2, start + 3];
  const missIdx = randInt(1, 2);
  const correct = seq[missIdx];
  const display = seq.map((n, i) => i === missIdx ? '__' : n);
  const options = new Set([correct]);
  while (options.size < 4) options.add(randInt(0, max));
  return {
    type: 'missing-number',
    grade: 'kindergarten',
    topic: 'numbers',
    difficulty: diff,
    prompt: "What's missing?",
    speak: `What number is missing?`,
    correctAnswer: correct,
    options: shuffle([...options]),
    visual: { sequence: display }
  };
}

function gen1Add(diff = 1) {
  const max = diff === 1 ? 10 : diff === 2 ? 15 : 20;
  const a = randInt(1, max - 1);
  const b = randInt(1, max - a);
  const sum = a + b;
  const options = new Set([sum]);
  while (options.size < 4) options.add(randInt(1, max + 5));
  return {
    type: 'addition',
    grade: 'first',
    topic: 'addition',
    difficulty: diff,
    prompt: `${a} + ${b} = ?`,
    speak: `What is ${a} plus ${b}?`,
    correctAnswer: sum,
    options: shuffle([...options]),
    visual: { a, b, emoji: pickEmoji() }
  };
}

function gen1Sub(diff = 1) {
  const max = diff === 1 ? 10 : diff === 2 ? 15 : 20;
  const a = randInt(2, max);
  const b = randInt(1, a - 1);
  const left = a - b;
  const options = new Set([left]);
  while (options.size < 4) options.add(randInt(0, max));
  return {
    type: 'subtraction',
    grade: 'first',
    topic: 'subtraction',
    difficulty: diff,
    prompt: `${a} − ${b} = ?`,
    speak: `What is ${a} minus ${b}?`,
    correctAnswer: left,
    options: shuffle([...options]),
    visual: { a, b, emoji: pickEmoji() }
  };
}

function gen1PlaceValue(diff = 1) {
  const tens = randInt(1, diff === 1 ? 5 : 9);
  const ones = randInt(0, 9);
  const num = tens * 10 + ones;
  return {
    type: 'place-value',
    grade: 'first',
    topic: 'placevalue',
    difficulty: diff,
    prompt: 'What number?',
    speak: `What number is shown? ${tens} tens and ${ones} ones.`,
    correctAnswer: num,
    options: shuffle([num, num + 10, Math.max(0, num - 1), tens * 10 + ((ones + 2) % 10)]),
    visual: { tens, ones }
  };
}

function gen1Counting(diff = 1) {
  const start = randInt(10, diff === 1 ? 50 : 100);
  const seq = [start, start + 1, start + 2, start + 3];
  const missIdx = randInt(1, 2);
  const correct = seq[missIdx];
  const display = seq.map((n, i) => i === missIdx ? '__' : n);
  const options = new Set([correct]);
  while (options.size < 4) options.add(correct + randInt(-3, 3));
  return {
    type: 'missing-number',
    grade: 'first',
    topic: 'counting',
    difficulty: diff,
    prompt: "What's missing?",
    speak: `What number is missing?`,
    correctAnswer: correct,
    options: shuffle([...options]),
    visual: { sequence: display }
  };
}

function gen1Time(diff = 1) {
  const hours = randInt(1, 12);
  const isHalf = diff >= 2 && Math.random() > 0.5;
  const minutes = isHalf ? 30 : 0;
  const label = isHalf ? `${hours}:30` : `${hours}:00`;
  let options = [label, `${hours}:30`, `${(hours % 12) + 1}:00`, `${hours}:15`];
  options = [...new Set(options)];
  while (options.length < 4) options.push(`${randInt(1,12)}:00`);
  return {
    type: 'time',
    grade: 'first',
    topic: 'time',
    difficulty: diff,
    prompt: 'What time is it?',
    speak: `What time is shown on the clock?`,
    correctAnswer: label,
    options: shuffle(options.slice(0, 4)),
    visual: { hours, minutes }
  };
}

function gen1Fractions(diff = 1) {
  const isHalf = Math.random() > 0.4;
  const correct = isHalf ? 'half' : 'quarter';
  return {
    type: 'fractions',
    grade: 'first',
    topic: 'fractions',
    difficulty: diff,
    prompt: `Which shows one ${correct}?`,
    speak: `Which picture shows one ${correct}?`,
    correctAnswer: correct,
    options: ['half', 'quarter', 'whole', 'three-quarters'],
    visual: { target: correct }
  };
}

function gen2Add(diff = 1) {
  let a, b;
  if (diff === 1) { a = randInt(10, 40); b = randInt(5, 20); }
  else if (diff === 2) { a = randInt(20, 60); b = randInt(15, 35); }
  else { a = randInt(30, 80); b = randInt(20, 50); }
  const sum = a + b;
  const options = new Set([sum]);
  while (options.size < 4) options.add(sum + randInt(-10, 10));
  return {
    type: 'addition',
    grade: 'second',
    topic: 'addition',
    difficulty: diff,
    prompt: `${a} + ${b} = ?`,
    speak: `What is ${a} plus ${b}?`,
    correctAnswer: sum,
    options: shuffle([...options]),
    visual: { a, b }
  };
}

function gen2Sub(diff = 1) {
  let a, b;
  if (diff === 1) { a = randInt(20, 50); b = randInt(5, 15); }
  else { a = randInt(40, 90); b = randInt(15, 40); }
  if (b > a) { const t = a; a = b; b = t; }
  const left = a - b;
  const options = new Set([left]);
  while (options.size < 4) options.add(left + randInt(-8, 8));
  return {
    type: 'subtraction',
    grade: 'second',
    topic: 'subtraction',
    difficulty: diff,
    prompt: `${a} − ${b} = ?`,
    speak: `What is ${a} minus ${b}?`,
    correctAnswer: left,
    options: shuffle([...options]),
    visual: { a, b }
  };
}

function gen2PlaceValue(diff = 1) {
  const hundreds = randInt(1, 9);
  const tens = randInt(0, 9);
  const ones = randInt(0, 9);
  const num = hundreds * 100 + tens * 10 + ones;
  if (Math.random() > 0.5) {
    const place = ['hundreds', 'tens', 'ones'][randInt(0, 2)];
    const digit = place === 'hundreds' ? hundreds : place === 'tens' ? tens : ones;
    const val = place === 'hundreds' ? hundreds * 100 : place === 'tens' ? tens * 10 : ones;
    const options = new Set([val]);
    while (options.size < 4) {
      const mult = place === 'hundreds' ? 100 : place === 'tens' ? 10 : 1;
      options.add(Math.max(0, val + mult * randInt(-2, 2)));
    }
    return {
      type: 'place-value-value',
      grade: 'second',
      topic: 'placevalue',
      difficulty: diff,
      prompt: `Value of the ${digit} in ${num}?`,
      speak: `In ${num}, what is the value of the ${digit}?`,
      correctAnswer: val,
      options: shuffle([...options]),
      visual: { hundreds, tens, ones, num }
    };
  }
  return {
    type: 'place-value',
    grade: 'second',
    topic: 'placevalue',
    difficulty: diff,
    prompt: 'What number?',
    speak: `What number is ${hundreds} hundreds, ${tens} tens, and ${ones} ones?`,
    correctAnswer: num,
    options: shuffle([num, num + 100, Math.max(0, num - 10), hundreds * 100 + ones]),
    visual: { hundreds, tens, ones }
  };
}

function gen2Money(diff = 1) {
  const coins = [
    { name: 'penny', value: 1, emoji: '🪙' },
    { name: 'nickel', value: 5, emoji: '🪙' },
    { name: 'dime', value: 10, emoji: '🪙' },
    { name: 'quarter', value: 25, emoji: '🪙' }
  ];
  let total = 0;
  const selected = [];
  const count = diff === 1 ? 2 : diff === 2 ? 3 : 4;
  for (let i = 0; i < count; i++) {
    const c = coins[randInt(0, coins.length - 1)];
    selected.push(c);
    total += c.value;
  }
  const dollars = (total / 100).toFixed(2);
  const options = new Set([`$${dollars}`]);
  while (options.size < 4) {
    const alt = total + randInt(-20, 20);
    if (alt > 0) options.add(`$${(alt / 100).toFixed(2)}`);
  }
  return {
    type: 'money',
    grade: 'second',
    topic: 'money',
    difficulty: diff,
    prompt: 'How much money?',
    speak: `How much money is shown?`,
    correctAnswer: `$${dollars}`,
    options: shuffle([...options]),
    visual: { coins: selected, total }
  };
}

function gen2Time(diff = 1) {
  const hours = randInt(1, 12);
  const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const minutes = mins[randInt(0, diff === 1 ? 3 : 11)];
  const label = `${hours}:${minutes.toString().padStart(2, '0')}`;
  const options = new Set([label]);
  while (options.size < 4) {
    const m = mins[randInt(0, 11)];
    options.add(`${randInt(1, 12)}:${m.toString().padStart(2, '0')}`);
  }
  return {
    type: 'time',
    grade: 'second',
    topic: 'time',
    difficulty: diff,
    prompt: 'What time is it?',
    speak: `What time is shown on the clock?`,
    correctAnswer: label,
    options: shuffle([...options]),
    visual: { hours, minutes }
  };
}

function gen2Measurement(diff = 1) {
  const length = randInt(2, diff === 1 ? 6 : 10);
  const unit = Math.random() > 0.5 ? 'inches' : 'cm';
  const options = new Set([`${length} ${unit}`]);
  while (options.size < 4) {
    options.add(`${randInt(1, 12)} ${unit}`);
  }
  return {
    type: 'measurement',
    grade: 'second',
    topic: 'measurement',
    difficulty: diff,
    prompt: 'How long is the pencil?',
    speak: `How long is the pencil?`,
    correctAnswer: `${length} ${unit}`,
    options: shuffle([...options]),
    visual: { length, unit }
  };
}

function gen2EqualGroups(diff = 1) {
  const groups = randInt(2, diff === 1 ? 3 : 4);
  const perGroup = randInt(2, diff === 1 ? 3 : 5);
  const total = groups * perGroup;
  const emoji = pickEmoji();
  const options = new Set([total]);
  while (options.size < 4) options.add(randInt(4, 20));
  return {
    type: 'equal-groups',
    grade: 'second',
    topic: 'equalgroups',
    difficulty: diff,
    prompt: `How many altogether?`,
    speak: `There are ${groups} groups of ${perGroup}. How many altogether?`,
    correctAnswer: total,
    options: shuffle([...options]),
    visual: { groups, perGroup, emoji, total }
  };
}

const GRADE_TOPICS = {
  kindergarten: [
    { id: 'numbers', name: 'Numbers', icon: '🔢', color: 'bg-green-400' },
    { id: 'counting', name: 'Counting', icon: '👆', color: 'bg-lime-400' },
    { id: 'addition', name: 'Adding', icon: '➕', color: 'bg-emerald-400' },
    { id: 'subtraction', name: 'Taking Away', icon: '➖', color: 'bg-teal-400' },
    { id: 'shapes', name: 'Shapes', icon: '🔷', color: 'bg-cyan-400' }
  ],
  first: [
    { id: 'addition', name: 'Addition', icon: '➕', color: 'bg-blue-400' },
    { id: 'subtraction', name: 'Subtraction', icon: '➖', color: 'bg-sky-400' },
    { id: 'placevalue', name: 'Tens & Ones', icon: '🔟', color: 'bg-indigo-400' },
    { id: 'counting', name: 'Counting', icon: '🔢', color: 'bg-violet-400' },
    { id: 'time', name: 'Time', icon: '⏰', color: 'bg-purple-400' },
    { id: 'fractions', name: 'Fractions', icon: '🍕', color: 'bg-fuchsia-400' }
  ],
  second: [
    { id: 'addition', name: 'Addition', icon: '➕', color: 'bg-purple-400' },
    { id: 'subtraction', name: 'Subtraction', icon: '➖', color: 'bg-violet-400' },
    { id: 'placevalue', name: 'Place Value', icon: '🔢', color: 'bg-indigo-400' },
    { id: 'money', name: 'Money', icon: '💰', color: 'bg-yellow-400' },
    { id: 'time', name: 'Time', icon: '⏰', color: 'bg-orange-400' },
    { id: 'measurement', name: 'Measurement', icon: '📏', color: 'bg-amber-400' },
    { id: 'equalgroups', name: 'Equal Groups', icon: '👥', color: 'bg-rose-400' }
  ]
};

const GENERATORS = {
  kindergarten: {
    numbers: [genKGNumberRecognition, genKGMissingNumber],
    counting: [genKGCounting],
    addition: [genKGAddition],
    subtraction: [genKGSubtraction],
    shapes: [genKGShapes]
  },
  first: {
    addition: [gen1Add],
    subtraction: [gen1Sub],
    placevalue: [gen1PlaceValue],
    counting: [gen1Counting],
    time: [gen1Time],
    fractions: [gen1Fractions]
  },
  second: {
    addition: [gen2Add],
    subtraction: [gen2Sub],
    placevalue: [gen2PlaceValue],
    money: [gen2Money],
    time: [gen2Time],
    measurement: [gen2Measurement],
    equalgroups: [gen2EqualGroups]
  }
};

function generateQuestion(grade, topic, difficulty = 1) {
  const gens = GENERATORS[grade] && GENERATORS[grade][topic];
  if (!gens || gens.length === 0) return genKGNumberRecognition(1);
  const gen = gens[randInt(0, gens.length - 1)];
  return gen(difficulty);
}

function generateDaily(grade) {
  const counts = {
    kindergarten: { numbers: 3, counting: 3, addition: 2, subtraction: 2, shapes: 2 },
    first: { addition: 3, subtraction: 3, placevalue: 2, counting: 2, time: 2, fractions: 1 },
    second: { addition: 2, subtraction: 2, placevalue: 2, money: 2, time: 2, measurement: 1, equalgroups: 2 }
  };
  const plan = counts[grade] || counts.kindergarten;
  const questions = [];
  Object.entries(plan).forEach(([topic, n]) => {
    for (let i = 0; i < n; i++) {
      questions.push(generateQuestion(grade, topic, randInt(1, 2)));
    }
  });
  return shuffle(questions);
}

const BADGE_DEFS = [
  { id: 'first-star', name: 'First Star', icon: '⭐', condition: (p) => p.stars >= 1 },
  { id: 'counting-champ', name: 'Counting Champion', icon: '🔢', condition: (p) => (p.topics && p.topics.counting && p.topics.counting.correct || 0) >= 10 },
  { id: 'shape-explorer', name: 'Shape Explorer', icon: '🔷', condition: (p) => (p.topics && p.topics.shapes && p.topics.shapes.correct || 0) >= 8 },
  { id: 'number-ninja', name: 'Number Ninja', icon: '🥷', condition: (p) => (p.topics && p.topics.numbers && p.topics.numbers.correct || 0) >= 15 },
  { id: 'add-master', name: 'Addition Master', icon: '➕', condition: (p) => (p.topics && p.topics.addition && p.topics.addition.correct || 0) >= 12 },
  { id: 'time-master', name: 'Time Master', icon: '⏰', condition: (p) => (p.topics && p.topics.time && p.topics.time.correct || 0) >= 8 },
  { id: 'streak-5', name: 'On a Roll!', icon: '🔥', condition: (p) => (p.currentStreak || 0) >= 5 },
  { id: 'daily-hero', name: 'Daily Hero', icon: '📅', condition: (p) => (p.dailyStreak || 0) >= 3 }
];

// ==================== COMPONENTS ====================

function StarReward({ show, onDone }) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onDone, 1200);
      return () => clearTimeout(t);
    }
  }, [show, onDone]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="text-8xl star-burst">⭐</div>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    left: Math.random() * 100 + '%',
    delay: Math.random() * 0.4 + 's',
    emoji: ['🎉', '⭐', '🌟', '✨', '🎊'][randInt(0, 4)]
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="absolute text-3xl animate-bounce" style={{ left: p.left, top: '-20px', animationDelay: p.delay, animationDuration: '1.4s' }}>
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div className="flex justify-between text-lg mb-1 font-bold text-gray-700">
        <span>Question {current} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

function SpeakButton({ text, enabled }) {
  return (
    <button type="button" onClick={() => speak(text, enabled)} className="btn-big bg-sky-300 hover:bg-sky-400 text-white shadow-lg flex items-center justify-center px-4" aria-label="Read question aloud">
      🔊
    </button>
  );
}

function HintButton({ onHint, disabled }) {
  return (
    <button type="button" onClick={onHint} disabled={disabled} className="btn-big bg-yellow-300 hover:bg-yellow-400 text-gray-800 shadow-lg px-4 disabled:opacity-50" aria-label="Get a hint">
      💡 Hint
    </button>
  );
}

function AnswerButton({ value, onClick, selected, correct, showResult, disabled }) {
  let cls = 'answer-btn btn-big shadow-lg border-4 ';
  if (showResult) {
    if (String(value) === String(correct)) cls += 'bg-green-400 border-green-600 text-white';
    else if (selected && String(value) !== String(correct)) cls += 'bg-orange-200 border-orange-400 text-gray-700';
    else cls += 'bg-white border-gray-200 text-gray-600 opacity-70';
  } else {
    cls += selected ? 'bg-blue-300 border-blue-500 text-white' : 'bg-white border-blue-200 hover:bg-blue-50 text-gray-800';
  }
  return (
    <button type="button" onClick={() => !disabled && onClick(value)} disabled={disabled} className={cls} aria-label={'Answer ' + value}>
      {value}
    </button>
  );
}

function VisualObjects({ emoji, count, animateJoin, animateLeave, leaveCount }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="flex flex-wrap justify-center gap-1 my-4 max-w-lg mx-auto" aria-hidden="true">
      {items.map(i => (
        <span key={i} className={'object-emoji ' + (animateJoin ? 'joining ' : '') + (animateLeave && i >= count - leaveCount ? 'leaving' : '')}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

function BaseTenBlocks({ tens, ones, hundreds }) {
  hundreds = hundreds || 0;
  return (
    <div className="flex flex-wrap justify-center items-end gap-4 my-4" aria-hidden="true">
      {hundreds > 0 && (
        <div className="flex flex-col items-center">
          <div className="flex flex-wrap gap-1 max-w-[120px]">
            {Array.from({ length: hundreds }, (_, i) => (
              <div key={i} className="w-10 h-10 bg-purple-500 rounded border-2 border-purple-700" />
            ))}
          </div>
          <span className="text-sm font-bold mt-1">{hundreds} hundreds</span>
        </div>
      )}
      {tens > 0 && (
        <div className="flex flex-col items-center">
          <div className="flex gap-1">
            {Array.from({ length: tens }, (_, i) => (
              <div key={i} className="w-4 h-16 bg-blue-500 rounded border-2 border-blue-700" />
            ))}
          </div>
          <span className="text-sm font-bold mt-1">{tens} tens</span>
        </div>
      )}
      {ones > 0 && (
        <div className="flex flex-col items-center">
          <div className="flex flex-wrap gap-1 max-w-[80px]">
            {Array.from({ length: ones }, (_, i) => (
              <div key={i} className="w-5 h-5 bg-green-500 rounded-full border-2 border-green-700" />
            ))}
          </div>
          <span className="text-sm font-bold mt-1">{ones} ones</span>
        </div>
      )}
    </div>
  );
}

function AnalogClock({ hours, minutes, size }) {
  size = size || 220;
  const hourDeg = ((hours % 12) + minutes / 60) * 30;
  const minDeg = minutes * 6;
  return (
    <div className="clock-face mx-auto my-4" style={{ width: size, height: size }} role="img" aria-label={'Clock showing ' + hours + ':' + minutes.toString().padStart(2, '0')}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="absolute w-1 h-3 bg-gray-700" style={{ left: '50%', top: '8px', transform: 'translateX(-50%) rotate(' + (i * 30) + 'deg)', transformOrigin: 'center ' + (size / 2 - 8) + 'px' }} />
      ))}
      {[12, 3, 6, 9].map((n, i) => {
        const pos = [
          { top: 12, left: '50%', transform: 'translateX(-50%)' },
          { top: '50%', right: 12, transform: 'translateY(-50%)' },
          { bottom: 12, left: '50%', transform: 'translateX(-50%)' },
          { top: '50%', left: 12, transform: 'translateY(-50%)' }
        ][i];
        return <span key={n} className="absolute text-lg font-bold text-gray-800" style={pos}>{n}</span>;
      })}
      <div className="clock-hand" style={{ width: 8, height: size * 0.28, marginLeft: -4, transform: 'rotate(' + hourDeg + 'deg)', background: '#1e3a5f' }} />
      <div className="clock-hand" style={{ width: 5, height: size * 0.38, marginLeft: -2.5, transform: 'rotate(' + minDeg + 'deg)', background: '#dc2626' }} />
      <div className="clock-center" />
    </div>
  );
}

function ShapeDisplay({ shape }) {
  const map = {
    circle: <div className="w-24 h-24 rounded-full bg-red-400 border-4 border-red-600" />,
    square: <div className="w-24 h-24 bg-blue-400 border-4 border-blue-600" />,
    triangle: <div className="w-0 h-0 border-l-[48px] border-r-[48px] border-b-[84px] border-l-transparent border-r-transparent border-b-green-500" />,
    rectangle: <div className="w-32 h-20 bg-yellow-400 border-4 border-yellow-600" />,
    sphere: <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-300 to-purple-600 border-4 border-purple-700" />,
    cube: <div className="w-24 h-24 bg-pink-400 border-4 border-pink-600" />
  };
  return (
    <div className="flex flex-col items-center gap-2">
      {map[shape.name] || <span className="text-6xl">{shape.emoji}</span>}
      <span className="text-lg font-bold capitalize text-gray-700">{shape.name}</span>
    </div>
  );
}

function FractionVisual({ type }) {
  if (type === 'half') {
    return (
      <div className="flex gap-4 justify-center">
        <div className="w-28 h-28 rounded-full border-4 border-gray-700 overflow-hidden flex">
          <div className="w-1/2 bg-red-400" /><div className="w-1/2 bg-white" />
        </div>
        <div className="w-28 h-28 border-4 border-gray-700 overflow-hidden flex flex-col">
          <div className="h-1/2 bg-blue-400" /><div className="h-1/2 bg-white" />
        </div>
      </div>
    );
  }
  if (type === 'quarter') {
    return (
      <div className="flex gap-4 justify-center">
        <div className="w-28 h-28 rounded-full border-4 border-gray-700 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-green-400" />
        </div>
        <div className="w-28 h-28 border-4 border-gray-700 grid grid-cols-2 grid-rows-2">
          <div className="bg-orange-400" /><div className="bg-white" /><div className="bg-white" /><div className="bg-white" />
        </div>
      </div>
    );
  }
  return <div className="w-28 h-28 rounded-full bg-yellow-400 border-4 border-gray-700 mx-auto" />;
}

function RulerVisual({ length, unit }) {
  return (
    <div className="my-4">
      <div className="relative mx-auto" style={{ width: Math.min(length * 30, 360) + 'px' }}>
        <div className="h-10 bg-yellow-200 border-2 border-yellow-600 rounded flex items-end">
          {Array.from({ length: length }, (_, i) => (
            <div key={i} className="flex-1 border-r border-yellow-700 h-full relative">
              <span className="absolute bottom-0 left-0 text-xs font-bold pl-0.5">{i}</span>
            </div>
          ))}
        </div>
        <div className="absolute -top-8 left-0 right-0 flex justify-center"><span className="text-4xl">✏️</span></div>
      </div>
      <p className="text-center text-sm text-gray-600 mt-2">Pencil is {length} {unit} long</p>
    </div>
  );
}

function EqualGroupsVisual({ groups, perGroup, emoji }) {
  return (
    <div className="flex flex-col gap-3 my-4 items-center">
      {Array.from({ length: groups }, (_, g) => (
        <div key={g} className="flex gap-1 p-2 bg-white/60 rounded-xl border-2 border-dashed border-gray-400">
          {Array.from({ length: perGroup }, (_, i) => (
            <span key={i} className="text-3xl">{emoji}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function MoneyVisual({ coins }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 my-4">
      {coins.map((c, i) => (
        <div key={i} className="flex flex-col items-center bg-white rounded-xl p-2 shadow border-2 border-yellow-300">
          <span className="text-4xl">{c.emoji}</span>
          <span className="text-sm font-bold capitalize">{c.name}</span>
          <span className="text-xs text-gray-500">{c.value}¢</span>
        </div>
      ))}
    </div>
  );
}

function ActivityScreen({ question, onAnswer, onBack, audioEnabled }) {
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  // Reset all answer-specific UI whenever the question changes.
  // Without this, showResult stays true from the previous question,
  // which disables the answer buttons on the next question.
  useEffect(() => {
    setSelected(null);
    setShowResult(false);
    setIsCorrect(false);
    setAttempts(0);
    setShowHint(false);
    setFeedback('');
    setShowConfetti(false);
  }, [question]);

  const handleSelect = (val) => {
    if (showResult) return;
    setSelected(val);
  };

  const handleSubmit = () => {
    if (selected === null || showResult) return;
    const correct = String(selected) === String(question.correctAnswer);
    setIsCorrect(correct);
    setShowResult(true);
    setAttempts(a => a + 1);
    if (correct) {
      setFeedback(['Great job! 🌟', 'Awesome! 🎉', 'You got it! ⭐', 'Super! 🚀'][randInt(0, 3)]);
      setShowConfetti(true);
      speak(audioEnabled ? 'Great job!' : '', audioEnabled);
      setTimeout(() => onAnswer(true, attempts + 1), 1400);
    } else {
      const msgs = attempts === 0 ? ['Almost! Try again 😊', "Not quite. Let's try again!", 'Close! Give it another try!'] : ["Let's try it together!", 'Here is a hint to help!'];
      setFeedback(msgs[Math.min(attempts, msgs.length - 1)]);
      if (attempts >= 1) setShowHint(true);
      speak(audioEnabled ? 'Almost, try again!' : '', audioEnabled);
      setTimeout(() => { setShowResult(false); setSelected(null); }, 1600);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (selected !== null && !showResult) handleSubmit();
      }
      if (e.key >= '0' && e.key <= '9' && question.options) {
        const num = parseInt(e.key, 10);
        if (question.options.includes(num) || question.options.includes(String(num))) {
          handleSelect(question.options.includes(num) ? num : String(num));
        }
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && question.options) {
        e.preventDefault();
        const opts = question.options;
        const idx = opts.findIndex(o => String(o) === String(selected));
        let next = idx;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % opts.length;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + opts.length) % opts.length;
        if (idx === -1) next = 0;
        handleSelect(opts[next]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, selected, showResult, audioEnabled]);

  const renderVisual = () => {
    const v = question.visual;
    if (!v) return null;
    if (question.type === 'counting') return <VisualObjects emoji={v.emoji} count={v.count} />;
    if (question.type === 'visual-addition') return (
      <div>
        <VisualObjects emoji={v.emoji} count={v.a} />
        <div className="text-4xl font-bold text-center my-2">+</div>
        <VisualObjects emoji={v.emoji} count={v.b} animateJoin />
      </div>
    );
    if (question.type === 'visual-subtraction') return <VisualObjects emoji={v.emoji} count={v.total} animateLeave leaveCount={v.take} />;
    if (question.type === 'place-value' || question.type === 'place-value-value') return <BaseTenBlocks tens={v.tens} ones={v.ones} hundreds={v.hundreds || 0} />;
    if (question.type === 'time') return <AnalogClock hours={v.hours} minutes={v.minutes} />;
    if (question.type === 'money') return <MoneyVisual coins={v.coins} />;
    if (question.type === 'measurement') return <RulerVisual length={v.length} unit={v.unit} />;
    if (question.type === 'equal-groups') return <EqualGroupsVisual groups={v.groups} perGroup={v.perGroup} emoji={v.emoji} />;
    if (question.type === 'missing-number') return (
      <div className="flex justify-center gap-3 my-4 text-4xl font-bold">
        {v.sequence.map((n, i) => (
          <span key={i} className={'px-4 py-2 rounded-xl ' + (n === '__' ? 'bg-yellow-200 border-2 border-dashed border-yellow-500' : 'bg-white border-2 border-gray-300')}>{n}</span>
        ))}
      </div>
    );
    return null;
  };

  const renderOptions = () => {
    if (question.type === 'shapes') {
      return (
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {question.options.map((shape, i) => (
            <button key={i} type="button" onClick={() => handleSelect(shape.name)}
              className={'shape-btn btn-big shadow-lg border-4 ' + (selected === shape.name ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-white') + (showResult && shape.name === question.correctAnswer ? ' border-green-500 bg-green-100' : '')}
              aria-label={shape.name}>
              <ShapeDisplay shape={shape} />
            </button>
          ))}
        </div>
      );
    }
    if (question.type === 'fractions') {
      return (
        <div className="flex flex-wrap justify-center gap-6 mt-4">
          {['half', 'quarter'].map((f) => (
            <button key={f} type="button" onClick={() => handleSelect(f)}
              className={'btn-big p-4 shadow-lg border-4 ' + (selected === f ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white')}>
              <FractionVisual type={f} />
              <span className="block mt-2 font-bold capitalize">{f}</span>
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-6">
        {question.options.map((opt, i) => (
          <AnswerButton key={i} value={opt} onClick={handleSelect} selected={selected === opt} correct={question.correctAnswer} showResult={showResult} disabled={showResult} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col">
      {showConfetti && <Confetti />}
      <div className="flex justify-between items-center mb-4 max-w-4xl mx-auto w-full">
        <button type="button" onClick={onBack} className="btn-big bg-white shadow-md px-6 text-2xl" aria-label="Go back">← Back</button>
        <div className="flex gap-3">
          <SpeakButton text={question.speak || question.prompt} enabled={audioEnabled} />
          <HintButton onHint={() => setShowHint(true)} disabled={showHint} />
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-2">{question.prompt}</h2>
        {renderVisual()}
        {showHint && (
          <div className="hint-box my-4 max-w-md text-center text-lg">
            {question.type === 'visual-addition' && <p>Count the first group, then the second, then count them all together!</p>}
            {question.type === 'visual-subtraction' && <p>Start with {question.visual.total}, take away {question.visual.take}. Count what's left.</p>}
            {question.type === 'counting' && <p>Point to each one and count: 1, 2, 3...</p>}
            {(question.type === 'place-value' || question.type === 'place-value-value') && <p>Each long blue rod is 10. Each green circle is 1.</p>}
            {question.type === 'time' && <p>The short hand shows the hour. The long hand shows the minutes.</p>}
            {!['visual-addition','visual-subtraction','counting','place-value','place-value-value','time'].includes(question.type) && <p>Look carefully and choose the best answer!</p>}
          </div>
        )}
        {renderOptions()}
        {selected !== null && !showResult && (
          <button type="button" onClick={handleSubmit} className="mt-8 btn-big bg-green-400 hover:bg-green-500 text-white text-2xl px-12 shadow-xl animate-pop" aria-label="Check answer">Check ✓</button>
        )}
        {showResult && (
          <div className={'mt-6 text-3xl font-bold text-center animate-pop ' + (isCorrect ? 'text-green-600' : 'text-orange-600')}>{feedback}</div>
        )}
      </div>
    </div>
  );
}

function HomeScreen({ progress, onSelectGrade, onProgress, onParent, onDaily }) {
  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <header className="text-center mb-8 mt-4">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-800 mb-2">👋 Math Fun!</h1>
        <p className="text-2xl text-gray-600">Let's practice math!</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mb-10">
        {[
          { id: 'kindergarten', name: 'Kindergarten', color: 'bg-green-400', emoji: '🟢', desc: 'Numbers, Counting, Shapes' },
          { id: 'first', name: '1st Grade', color: 'bg-blue-400', emoji: '🔵', desc: 'Addition, Time, Fractions' },
          { id: 'second', name: '2nd Grade', color: 'bg-purple-400', emoji: '🟣', desc: 'Place Value, Money, Groups' }
        ].map(g => (
          <button key={g.id} type="button" onClick={() => onSelectGrade(g.id)}
            className={'card-grade ' + g.color + ' rounded-3xl p-8 shadow-xl border-4 border-white text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500'}
            aria-label={'Select ' + g.name}>
            <div className="text-6xl mb-4">{g.emoji}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{g.name}</h2>
            <p className="text-white/90 text-lg">{g.desc}</p>
            {progress.selectedGrade === g.id && <div className="mt-3 text-white font-bold">✓ Current</div>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <button type="button" onClick={onDaily} className="btn-big bg-yellow-300 hover:bg-yellow-400 text-gray-800 px-8 shadow-lg">📅 Daily Math</button>
        <button type="button" onClick={onProgress} className="btn-big bg-white hover:bg-gray-50 text-gray-800 px-8 shadow-lg">⭐ My Progress</button>
        <button type="button" onClick={onParent} className="btn-big bg-gray-200 hover:bg-gray-300 text-gray-700 px-8 shadow-lg">👨‍👩‍👧 Parent</button>
      </div>
      <div className="mt-8 text-center text-xl text-gray-600">⭐ {progress.stars} stars collected</div>
    </div>
  );
}

function TopicScreen({ grade, progress, onSelectTopic, onBack }) {
  const topics = GRADE_TOPICS[grade] || [];
  const gradeName = { kindergarten: 'Kindergarten', first: '1st Grade', second: '2nd Grade' }[grade];
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <button type="button" onClick={onBack} className="btn-big bg-white shadow mb-6 px-6">← Home</button>
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">{gradeName} Topics</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topics.map(t => {
            const stats = (progress.topics && progress.topics[t.id]) || { correct: 0 };
            const stars = Math.min(5, Math.floor((stats.correct || 0) / 3));
            return (
              <button key={t.id} type="button" onClick={() => onSelectTopic(t.id)}
                className={t.color + ' rounded-3xl p-6 shadow-xl border-4 border-white text-left card-grade'}>
                <div className="text-5xl mb-3">{t.icon}</div>
                <h2 className="text-2xl font-bold text-white">{t.name}</h2>
                <div className="mt-2 text-white/90">{'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ModeSelect({ topicName, onLearn, onPractice, onBack }) {
  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center relative">
      <button type="button" onClick={onBack} className="absolute top-6 left-6 btn-big bg-white shadow px-6">← Back</button>
      <h1 className="text-4xl font-bold mb-10 text-gray-800">{topicName}</h1>
      <div className="flex flex-col sm:flex-row gap-6">
        <button type="button" onClick={onLearn} className="btn-big bg-sky-400 hover:bg-sky-500 text-white px-12 py-8 text-3xl shadow-xl">📚 Learn</button>
        <button type="button" onClick={onPractice} className="btn-big bg-green-400 hover:bg-green-500 text-white px-12 py-8 text-3xl shadow-xl">✏️ Practice</button>
      </div>
    </div>
  );
}

function LearnScreen({ grade, topic, onBack, onStartPractice }) {
  const explanations = {
    'kindergarten-addition': { title: 'Adding is Putting Together!', steps: [{ text: 'Here are 2 apples', visual: '🍎🍎' }, { text: 'Here are 3 more', visual: '🍎🍎🍎' }, { text: 'Put them together: 2 + 3 = 5', visual: '🍎🍎🍎🍎🍎' }] },
    'kindergarten-subtraction': { title: 'Taking Away', steps: [{ text: 'Here are 4 dogs', visual: '🐶🐶🐶🐶' }, { text: 'Take away 1', visual: '🐶🐶🐶' }, { text: '3 are left! 4 − 1 = 3', visual: '🐶🐶🐶' }] },
    'kindergarten-shapes': { title: 'Shapes All Around!', steps: [{ text: 'A circle is round like a ball', visual: '⭕' }, { text: 'A square has 4 equal sides', visual: '🟥' }, { text: 'A triangle has 3 sides', visual: '🔺' }] },
    'first-placevalue': { title: 'Tens and Ones', steps: [{ text: '10 ones make 1 ten', visual: '🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵 → 🟦' }, { text: '34 is 3 tens and 4 ones', visual: '🟦🟦🟦  ●●●●' }] },
    'second-equalgroups': { title: 'Equal Groups', steps: [{ text: '3 groups of 2 apples', visual: '🍎🍎   🍎🍎   🍎🍎' }, { text: 'Altogether: 3 × 2 = 6', visual: '🍎🍎🍎🍎🍎🍎' }] }
  };
  const key = grade + '-' + topic;
  const exp = explanations[key] || { title: "Let's Learn!", steps: [{ text: 'Practice makes perfect! Try the questions to learn.', visual: '🌟' }] };
  return (
    <div className="min-h-screen p-6 flex flex-col items-center">
      <button type="button" onClick={onBack} className="self-start btn-big bg-white shadow px-6 mb-6">← Back</button>
      <h1 className="text-4xl font-bold text-center mb-8">{exp.title}</h1>
      <div className="max-w-xl w-full space-y-6">
        {exp.steps.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-lg text-center">
            <p className="text-2xl mb-3">{s.text}</p>
            <div className="text-4xl">{s.visual}</div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onStartPractice} className="mt-10 btn-big bg-green-400 hover:bg-green-500 text-white px-12 text-2xl shadow-xl">Start Practice →</button>
    </div>
  );
}

function PracticeSession({ grade, topic, dailyQuestions, onFinish, onBack, audioEnabled, progress, setProgress }) {
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [streak, setStreak] = useState(0);
  const [showStar, setShowStar] = useState(false);

  useEffect(() => {
    // Start each practice session from a clean state.
    setIdx(0);
    setCorrectCount(0);
    setDifficulty(1);
    setStreak(0);
    setShowStar(false);

    if (dailyQuestions) {
      setQuestions(dailyQuestions);
    } else {
      const qs = [];
      for (let i = 0; i < 8; i++) qs.push(generateQuestion(grade, topic, 1));
      setQuestions(qs);
    }
  }, [grade, topic, dailyQuestions]);

  const current = questions[idx];

  const handleAnswer = (correct, attempts) => {
    const newProgress = Object.assign({}, progress);
    if (!newProgress.topics) newProgress.topics = {};
    if (!newProgress.topics[topic]) newProgress.topics[topic] = { correct: 0, attempts: 0 };
    newProgress.topics[topic].attempts += 1;
    if (correct) {
      newProgress.topics[topic].correct += 1;
      newProgress.stars = (newProgress.stars || 0) + 1;
      setCorrectCount(c => c + 1);
      setStreak(s => s + 1);
      setShowStar(true);
      if (streak + 1 >= 5) setDifficulty(d => Math.min(3, d + 1));
      BADGE_DEFS.forEach(b => {
        if (!(newProgress.badges || []).includes(b.id) && b.condition(Object.assign({}, newProgress, { currentStreak: streak + 1 }))) {
          newProgress.badges = (newProgress.badges || []).concat([b.id]);
        }
      });
    } else {
      setStreak(0);
      if (attempts >= 2) setDifficulty(d => Math.max(1, d - 1));
    }
    newProgress.history = ((newProgress.history || []).slice(-49)).concat([{ grade: grade, topic: topic, correct: correct, time: Date.now() }]);
    setProgress(newProgress);
    saveProgress(newProgress);
    if (idx + 1 >= questions.length) {
      setTimeout(() => onFinish(correctCount + (correct ? 1 : 0), questions.length), 800);
    } else {
      setTimeout(() => setIdx(i => i + 1), 600);
    }
  };

  if (!current) return <div className="min-h-screen flex items-center justify-center"><p className="text-2xl">Loading questions...</p></div>;

  return (
    <React.Fragment>
      <StarReward show={showStar} onDone={() => setShowStar(false)} />
      <div className="pt-2"><ProgressBar current={idx + 1} total={questions.length} /></div>
      <ActivityScreen question={current} onAnswer={handleAnswer} onBack={onBack} audioEnabled={audioEnabled} />
    </React.Fragment>
  );
}

function ResultsScreen({ correct, total, onHome, onAgain }) {
  const pct = Math.round((correct / total) * 100);
  let message = 'Nice try! Keep practicing! 💪';
  if (pct >= 90) message = 'Amazing! You are a math star! 🌟';
  else if (pct >= 70) message = 'Great job! 🎉';
  else if (pct >= 50) message = 'Good work! Keep going! 👍';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-8xl mb-4 animate-bounce-slow">🏆</div>
      <h1 className="text-4xl font-bold mb-2">{message}</h1>
      <p className="text-3xl mb-6">You got <span className="text-green-600 font-bold">{correct}</span> out of {total}</p>
      <div className="text-5xl mb-8">{'⭐'.repeat(Math.min(5, Math.ceil(pct / 20)))}</div>
      <div className="flex gap-4">
        <button type="button" onClick={onAgain} className="btn-big bg-green-400 text-white px-8">Practice More</button>
        <button type="button" onClick={onHome} className="btn-big bg-white shadow px-8">Home</button>
      </div>
    </div>
  );
}

function ProgressScreen({ progress, onBack }) {
  const topics = progress.topics || {};
  return (
    <div className="min-h-screen p-6">
      <button type="button" onClick={onBack} className="btn-big bg-white shadow mb-6 px-6">← Back</button>
      <h1 className="text-4xl font-bold text-center mb-8">⭐ My Progress</h1>
      <div className="max-w-lg mx-auto bg-white rounded-3xl p-6 shadow-xl">
        <p className="text-2xl text-center mb-4">Total Stars: <strong>{progress.stars || 0}</strong></p>
        <p className="text-xl text-center mb-6">Badges: {(progress.badges || []).length}</p>
        <div className="space-y-3">
          {Object.entries(topics).map(([id, stats]) => (
            <div key={id} className="flex justify-between items-center bg-gray-50 rounded-xl p-3">
              <span className="font-bold capitalize text-lg">{id}</span>
              <span>{'⭐'.repeat(Math.min(5, Math.floor((stats.correct || 0) / 3)))}<span className="text-sm text-gray-500 ml-2">{stats.correct || 0} correct</span></span>
            </div>
          ))}
          {Object.keys(topics).length === 0 && <p className="text-center text-gray-500">Start practicing to see progress!</p>}
        </div>
        {(progress.badges || []).length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold text-xl mb-2">Badges Earned</h3>
            <div className="flex flex-wrap gap-2">
              {progress.badges.map(id => {
                const b = BADGE_DEFS.find(x => x.id === id);
                return b ? <span key={id} className="bg-yellow-100 rounded-full px-3 py-1 text-lg">{b.icon} {b.name}</span> : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ParentGate({ onSuccess, onCancel }) {
  const [val, setVal] = useState('');
  const [step, setStep] = useState(0);
  const check = () => {
    if (parseInt(val, 10) === 7) onSuccess();
    else { setVal(''); setStep(s => s + 1); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-100">
      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center">
        <h2 className="text-2xl font-bold mb-4">Parent / Teacher Gate</h2>
        <p className="text-lg mb-4">What is 3 + 4?</p>
        <input type="number" value={val} onChange={e => setVal(e.target.value)} className="parent-gate border-4 border-gray-300 rounded-xl p-3 mb-4 w-full" autoFocus onKeyDown={e => e.key === 'Enter' && check()} />
        <div className="flex gap-3 justify-center">
          <button type="button" onClick={check} className="btn-big bg-blue-400 text-white px-6">Enter</button>
          <button type="button" onClick={onCancel} className="btn-big bg-gray-200 px-6">Cancel</button>
        </div>
        {step > 2 && <p className="mt-4 text-sm text-gray-500">Hint: 3 + 4 = 7</p>}
      </div>
    </div>
  );
}

function ParentDashboard({ progress, onBack, onReset, onToggleAudio, audioEnabled }) {
  const topics = progress.topics || {};
  const totalCorrect = Object.values(topics).reduce((s, t) => s + (t.correct || 0), 0);
  const totalAttempts = Object.values(topics).reduce((s, t) => s + (t.attempts || 0), 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <button type="button" onClick={onBack} className="btn-big bg-white shadow mb-6 px-6">← Back</button>
      <h1 className="text-3xl font-bold mb-6">Parent / Teacher Dashboard</h1>
      <div className="max-w-2xl space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow">
          <h3 className="font-bold text-xl mb-2">Overview</h3>
          <p>Current Grade: <strong>{progress.selectedGrade || 'Not set'}</strong></p>
          <p>Stars: {progress.stars || 0}</p>
          <p>Questions answered: {totalAttempts}</p>
          <p>Accuracy: {accuracy}%</p>
          <p>Badges: {(progress.badges || []).length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow">
          <h3 className="font-bold text-xl mb-2">Topics</h3>
          {Object.entries(topics).length === 0 && <p className="text-gray-500">No activity yet</p>}
          {Object.entries(topics).map(([id, s]) => (
            <div key={id} className="flex justify-between py-2 border-b">
              <span className="capitalize">{id}</span>
              <span>{s.correct || 0} / {s.attempts || 0} ({s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0}%)</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-5 shadow">
          <h3 className="font-bold text-xl mb-2">Settings</h3>
          <label className="flex items-center gap-3 text-lg">
            <input type="checkbox" checked={audioEnabled} onChange={onToggleAudio} className="w-6 h-6" /> Audio enabled
          </label>
          <button type="button" onClick={onReset} className="mt-4 btn-big bg-red-100 text-red-700 px-6 text-lg">Reset All Progress</button>
        </div>
        <div className="bg-yellow-50 rounded-2xl p-5 border-2 border-yellow-200">
          <h3 className="font-bold text-xl mb-2">Recommendations</h3>
          <p className="text-gray-700">{Object.entries(topics).filter(([, s]) => (s.correct || 0) < 5).map(([id]) => id).join(', ') || 'Keep practicing all topics!'}</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [screen, setScreen] = useState('home');
  const [grade, setGrade] = useState(progress.selectedGrade);
  const [topic, setTopic] = useState(null);
  const [dailyQs, setDailyQs] = useState(null);
  const [results, setResults] = useState({ correct: 0, total: 0 });
  const [audioEnabled, setAudioEnabled] = useState(progress.settings && progress.settings.audio !== false);

  useEffect(() => { saveProgress(progress); }, [progress]);

  const selectGrade = (g) => {
    setGrade(g);
    setProgress(p => Object.assign({}, p, { selectedGrade: g }));
    setScreen('topics');
  };

  const startDaily = () => {
    const g = grade || progress.selectedGrade || 'kindergarten';
    setGrade(g);
    setDailyQs(generateDaily(g));
    setTopic('daily');
    setScreen('practice');
  };

  const finishPractice = (correct, total) => {
    setResults({ correct: correct, total: total });
    setScreen('results');
  };

  const topicName = ((GRADE_TOPICS[grade] || []).find(t => t.id === topic) || {}).name || topic;

  return (
    <div className="font-kid">
      {screen === 'home' && <HomeScreen progress={progress} onSelectGrade={selectGrade} onProgress={() => setScreen('progress')} onParent={() => setScreen('parentgate')} onDaily={startDaily} />}
      {screen === 'topics' && <TopicScreen grade={grade} progress={progress} onSelectTopic={(t) => { setTopic(t); setScreen('mode'); }} onBack={() => setScreen('home')} />}
      {screen === 'mode' && <ModeSelect topicName={topicName} onLearn={() => setScreen('learn')} onPractice={() => { setDailyQs(null); setScreen('practice'); }} onBack={() => setScreen('topics')} />}
      {screen === 'learn' && <LearnScreen grade={grade} topic={topic} onBack={() => setScreen('mode')} onStartPractice={() => { setDailyQs(null); setScreen('practice'); }} />}
      {screen === 'practice' && <PracticeSession grade={grade} topic={topic === 'daily' ? 'addition' : topic} dailyQuestions={dailyQs} onFinish={finishPractice} onBack={() => setScreen(dailyQs ? 'home' : 'mode')} audioEnabled={audioEnabled} progress={progress} setProgress={setProgress} />}
      {screen === 'results' && <ResultsScreen correct={results.correct} total={results.total} onHome={() => setScreen('home')} onAgain={() => { setDailyQs(null); setScreen('practice'); }} />}
      {screen === 'progress' && <ProgressScreen progress={progress} onBack={() => setScreen('home')} />}
      {screen === 'parentgate' && <ParentGate onSuccess={() => setScreen('parent')} onCancel={() => setScreen('home')} />}
      {screen === 'parent' && <ParentDashboard progress={progress} onBack={() => setScreen('home')} onReset={() => { if (confirm('Reset all progress?')) { const fresh = loadProgress(); fresh.selectedGrade = progress.selectedGrade; setProgress(fresh); saveProgress(fresh); } }} onToggleAudio={() => { setAudioEnabled(a => { const next = !a; setProgress(p => Object.assign({}, p, { settings: Object.assign({}, p.settings, { audio: next }) })); return next; }); }} audioEnabled={audioEnabled} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
