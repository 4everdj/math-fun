const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ==================== STORAGE & PROGRESS ====================
const STORAGE_KEY = 'mathFunKids_v2';

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
    skills: {},
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

function getTotalStats(progress) {
  const topics = progress.topics || {};
  const attempts = Object.values(topics).reduce((sum, t) => sum + (t.attempts || 0), 0);
  const correct = Object.values(topics).reduce((sum, t) => sum + (t.correct || 0), 0);
  return { attempts, correct, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
}


function getTopicMastery(progress, topic) {
  const s = (progress.topics && progress.topics[topic]) || {};
  const attempts = s.attempts || 0;
  const correct = s.correct || 0;
  return attempts ? Math.round((correct / attempts) * 100) : 0;
}

const SKILL_CATALOG = {
  kindergarten: [
    ['numbers-recognition','Number Recognition','🔢','numbers'], ['numbers-missing','Missing Numbers','🧩','numbers'],
    ['counting','Counting & One-to-One','👆','counting'], ['addition','Addition Foundations','➕','addition'],
    ['subtraction','Subtraction Foundations','➖','subtraction'], ['shapes','Shapes & Geometry','🔷','shapes']
  ],
  first: [
    ['addition','Addition Strategies','➕','addition'], ['subtraction','Subtraction Strategies','➖','subtraction'],
    ['placevalue','Tens & Ones','🔟','placevalue'], ['counting','Counting & Number Patterns','🔢','counting'], ['time','Telling Time','⏰','time'],
    ['fractions-identify','Fraction Recognition','🍕','fractions'], ['fractions-name','Naming Fractions','🍰','fractions'],
    ['fractions-equal','Equal Shares','⚖️','fractions'], ['fractions-compare','Compare Fractions','📊','fractions'],
    ['fractions-numberline','Fractions on Number Lines','📏','fractions'], ['fractions-stories','Fraction Word Problems','🧠','fractions']
  ],
  second: [
    ['addition','Two-Digit Addition','➕','addition'], ['subtraction','Two-Digit Subtraction','➖','subtraction'],
    ['placevalue','Place Value & Decomposition','🔢','placevalue'], ['money','Money & Change','💰','money'],
    ['time','Time & Elapsed Time','⏰','time'], ['measurement','Measurement & Comparison','📏','measurement'],
    ['equalgroups','Equal Groups & Multiplication','👥','equalgroups']
  ]
};

function getSkills(grade, topic) {
  return (SKILL_CATALOG[grade] || []).filter(s => s[3] === topic);
}
function skillKey(grade, id) { return id && id.includes('.') ? id : `${grade}.${id}`; }
function getSkillStats(progress, skillId) {
  return (progress.skills && progress.skills[skillId]) || { attempts: 0, correct: 0 };
}
function getSkillAccuracy(progress, skillId) {
  const s = getSkillStats(progress, skillId);
  return s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0;
}


// ==================== LEARNING MAP ====================
const LEARNING_MAP = {
  kindergarten: [
    { skill:'numbers-recognition', title:'Number Recognition', icon:'🔢', prereq:[] },
    { skill:'numbers-missing', title:'Missing Numbers', icon:'🧩', prereq:['numbers-recognition'] },
    { skill:'counting', title:'Counting & One-to-One', icon:'👆', prereq:['numbers-missing'] },
    { skill:'addition', title:'Addition Foundations', icon:'➕', prereq:['counting'] },
    { skill:'subtraction', title:'Subtraction Foundations', icon:'➖', prereq:['addition'] },
    { skill:'shapes', title:'Shapes & Geometry', icon:'🔷', prereq:['numbers-recognition'] }
  ],
  first: [
    { skill:'counting', title:'Counting & Number Patterns', icon:'🔢', prereq:[] },
    { skill:'placevalue', title:'Tens & Ones', icon:'🔟', prereq:['counting'] },
    { skill:'addition', title:'Addition Strategies', icon:'➕', prereq:['placevalue'] },
    { skill:'subtraction', title:'Subtraction Strategies', icon:'➖', prereq:['addition'] },
    { skill:'time', title:'Telling Time', icon:'⏰', prereq:['counting'] },
    { skill:'fractions-identify', title:'Fraction Recognition', icon:'🍕', prereq:['counting'] },
    { skill:'fractions-name', title:'Naming Fractions', icon:'🍰', prereq:['fractions-identify'] },
    { skill:'fractions-equal', title:'Equal Shares', icon:'⚖️', prereq:['fractions-name'] },
    { skill:'fractions-compare', title:'Compare Fractions', icon:'📊', prereq:['fractions-equal'] },
    { skill:'fractions-numberline', title:'Fractions on Number Lines', icon:'📏', prereq:['fractions-compare'] },
    { skill:'fractions-stories', title:'Fraction Word Problems', icon:'🧠', prereq:['fractions-numberline'] }
  ],
  second: [
    { skill:'placevalue', title:'Place Value & Decomposition', icon:'🔢', prereq:[] },
    { skill:'addition', title:'Two-Digit Addition', icon:'➕', prereq:['placevalue'] },
    { skill:'subtraction', title:'Two-Digit Subtraction', icon:'➖', prereq:['addition'] },
    { skill:'money', title:'Money & Change', icon:'💰', prereq:['addition'] },
    { skill:'time', title:'Time & Elapsed Time', icon:'⏰', prereq:['placevalue'] },
    { skill:'measurement', title:'Measurement & Comparison', icon:'📏', prereq:['addition'] },
    { skill:'equalgroups', title:'Equal Groups & Multiplication', icon:'👥', prereq:['addition','placevalue'] }
  ]
};

function isSkillMastered(progress, grade, skill) {
  const st = getSkillStats(progress, skillKey(grade, skill));
  return st.attempts >= 5 && (st.correct / st.attempts) >= 0.8;
}
function isSkillUnlocked(progress, grade, skill) {
  const node = (LEARNING_MAP[grade] || []).find(x => x.skill === skill);
  return !!node && node.prereq.every(p => isSkillMastered(progress, grade, p));
}
function getNextLearningSkill(progress, grade) {
  const map = LEARNING_MAP[grade] || [];
  const unlocked = map.filter(n => isSkillUnlocked(progress, grade, n.skill));
  const unmastered = unlocked.filter(n => !isSkillMastered(progress, grade, n.skill));
  return (unmastered[0] || map[map.length - 1] || null).skill;
}

function getRecommendedSkill(progress, grade) {
  const skills = SKILL_CATALOG[grade] || [];
  if (!skills.length) return null;
  const next = getNextLearningSkill(progress, grade);
  const map = LEARNING_MAP[grade] || [];
  const nextNode = map.find(n => n.skill === next);
  if (nextNode && !isSkillMastered(progress, grade, next)) return skillKey(grade, next);
  const history = progress.history || [];
  return skills.map((s, index) => {
    const id = skillKey(grade, s[0]);
    const st = getSkillStats(progress, id);
    const recent = history.filter(h => h.grade === grade && h.skill === id).slice(-6);
    const misses = recent.filter(h => !h.correct).length;
    const unseen = st.attempts === 0;
    const accuracy = st.attempts ? st.correct / st.attempts : 0;
    const score = (unseen ? 100 : (1 - accuracy) * 80) + misses * 12 - Math.min(st.attempts, 15) * 0.25;
    return { id, topic: s[3], name: s[1], icon: s[2], score, index };
  }).sort((a,b) => b.score - a.score || a.index - b.index)[0].id;
}

function getSkillMeta(grade, skillId) {
  const raw = skillId && skillId.includes('.') ? skillId.split('.').slice(1).join('.') : skillId;
  const s = (SKILL_CATALOG[grade] || []).find(x => x[0] === raw);
  return s ? { id:s[0], name:s[1], icon:s[2], topic:s[3] } : null;
}

function getRecommendedTopic(progress, grade) {
  const topics = GRADE_TOPICS[grade] || [];
  if (!topics.length) return null;
  const history = (progress.history || []).filter(h => h.grade === grade);
  // Give unseen skills a gentle priority, then favor lower accuracy and recent misses.
  const scored = topics.map((t, index) => {
    const stats = (progress.topics && progress.topics[t.id]) || {};
    const attempts = stats.attempts || 0;
    const accuracy = attempts ? (stats.correct || 0) / attempts : 0;
    const recent = history.slice(-8).filter(h => h.topic === t.id);
    const recentMisses = recent.filter(h => !h.correct).length;
    const score = (attempts === 0 ? 100 : (1 - accuracy) * 70) + recentMisses * 8 - Math.min(attempts, 20) * 0.5;
    return { id: t.id, score, index };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0].id;
}

function getAdaptiveDifficulty(progress, grade, topic) {
  const stats = (progress.topics && progress.topics[topic]) || {};
  const attempts = stats.attempts || 0;
  const accuracy = attempts ? (stats.correct || 0) / attempts : 0;
  const recent = (progress.history || []).filter(h => h.grade === grade && h.topic === topic).slice(-6);
  const recentAccuracy = recent.length ? recent.filter(h => h.correct).length / recent.length : accuracy;
  if (attempts < 3) return 1;
  if (recentAccuracy >= 0.9 && accuracy >= 0.8) return 3;
  if (recentAccuracy >= 0.7 && accuracy >= 0.65) return 2;
  return 1;
}

function getTodayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

function makeFractionOptions(correct, pool = ['whole', 'half', 'quarter', 'three-quarters']) {
  // Use the provided pool (plus the correct answer). Never force 4 options when the
  // pool has fewer unique values — that previously caused an infinite loop for
  // Naming Fractions (pool of only half/quarter).
  const options = new Set([correct, ...pool]);
  return shuffle([...options]);
}

function fractionLabel(f) {
  return ({ whole: 'whole', half: 'one-half', quarter: 'one-fourth', 'three-quarters': 'three-fourths' })[f] || f;
}

function genFractionIdentify(diff = 1) {
  const choices = diff >= 3 ? ['half', 'quarter', 'three-quarters', 'whole'] : ['half', 'quarter', 'whole'];
  const correct = choices[randInt(0, choices.length - 1)];
  const options = makeFractionOptions(correct);
  return {
    type: 'fractions', grade: 'first', topic: 'fractions', difficulty: diff,
    prompt: `Which picture shows one ${fractionLabel(correct).replace('one-', '')}?`,
    speak: `Which picture shows ${fractionLabel(correct)}?`,
    correctAnswer: correct, options,
    visual: { mode: 'choice-grid', choices: options, target: correct }
  };
}

function genFractionName(diff = 1) {
  const choices = diff >= 3 ? ['half', 'quarter', 'three-quarters'] : ['half', 'quarter'];
  const correct = choices[randInt(0, choices.length - 1)];
  return {
    type: 'fractions', grade: 'first', topic: 'fractions', difficulty: diff,
    prompt: 'What fraction is shaded?',
    speak: `What fraction is shaded?`,
    correctAnswer: correct,
    options: makeFractionOptions(correct, choices),
    visual: { mode: 'single', target: correct }
  };
}

function genFractionEqualShares(diff = 1) {
  const equal = Math.random() > 0.5;
  const parts = diff >= 2 ? 4 : 2;
  return {
    type: 'fractions', grade: 'first', topic: 'fractions', difficulty: diff,
    prompt: 'Are all the shares equal?',
    speak: 'Are all the shares equal?',
    correctAnswer: equal ? 'yes' : 'no',
    options: ['yes', 'no'],
    visual: { mode: 'equal-shares', equal, parts }
  };
}

function genFractionCompare(diff = 1) {
  const pairs = [
    ['half', 'quarter'],
    ['three-quarters', 'half'],
    ['quarter', 'half']
  ];
  const [left, right] = pairs[randInt(0, pairs.length - 1)];
  const values = { quarter: 0.25, half: 0.5, 'three-quarters': 0.75 };
  const correct = values[left] > values[right] ? 'left' : values[left] < values[right] ? 'right' : 'same';
  return {
    type: 'fractions', grade: 'first', topic: 'fractions', difficulty: Math.max(2, diff),
    prompt: 'Which picture has more shaded?',
    speak: 'Which picture has more shaded?',
    correctAnswer: correct,
    options: ['left', 'right'],
    visual: { mode: 'compare', left, right }
  };
}

function genFractionNumberLine(diff = 1) {
  const choices = ['quarter', 'half', 'three-quarters'];
  const target = choices[randInt(0, choices.length - 1)];
  return {
    type: 'fractions', grade: 'first', topic: 'fractions', difficulty: Math.max(2, diff),
    prompt: 'Which fraction is marked on the number line?',
    speak: 'Which fraction is marked on the number line?',
    correctAnswer: target,
    options: choices,
    visual: { mode: 'number-line', target }
  };
}

function genFractionStory(diff = 1) {
  const stories = [
    { item: 'pizza', emoji: '🍕', denominator: 4, eaten: 1, answer: 'quarter' },
    { item: 'sandwich', emoji: '🥪', denominator: 2, eaten: 1, answer: 'half' },
    { item: 'cake', emoji: '🍰', denominator: 4, eaten: 3, answer: 'three-quarters' }
  ];
  const story = stories[randInt(0, stories.length - 1)];
  return {
    type: 'fractions', grade: 'first', topic: 'fractions', difficulty: Math.max(2, diff),
    prompt: `${story.item[0].toUpperCase() + story.item.slice(1)} is cut into ${story.denominator} equal parts. ${story.eaten} part${story.eaten > 1 ? 's' : ''} is eaten. What fraction was eaten?`,
    speak: `${story.item} is cut into ${story.denominator} equal parts. What fraction was eaten?`,
    correctAnswer: story.answer,
    options: makeFractionOptions(story.answer),
    visual: { mode: 'story', emoji: story.emoji, denominator: story.denominator, shaded: story.eaten }
  };
}

function gen1Fractions(diff = 1) {
  const generators = [genFractionIdentify, genFractionName];
  if (diff >= 2) generators.push(genFractionEqualShares, genFractionCompare, genFractionNumberLine);
  if (diff >= 3) generators.push(genFractionStory);
  return generators[randInt(0, generators.length - 1)](diff);
}

// Build a reliable fraction round.  We deliberately rotate through the different
// representations so a short 5-question round does not get stuck on one visual
// type or depend on a single random generator call.
function generateFractionPractice(count = 5, difficulty = 1, targetSkill = null) {
  const direct = {
    'first.fractions-identify': genFractionIdentify,
    'first.fractions-name': genFractionName,
    'first.fractions-equal': genFractionEqualShares,
    'first.fractions-compare': genFractionCompare,
    'first.fractions-numberline': genFractionNumberLine,
    'first.fractions-stories': genFractionStory
  };
  const skillFn = targetSkill && direct[targetSkill];
  const generators = skillFn ? [skillFn] : [
    genFractionIdentify, genFractionName, genFractionEqualShares,
    genFractionCompare, genFractionNumberLine, genFractionStory
  ];
  const questions = [];
  for (let i = 0; i < count; i++) {
    const fn = generators[i % generators.length];
    try {
      const q = fn(Math.max(1, difficulty));
      if (!q || !q.options || !q.visual) throw new Error('Invalid fraction question');
      if (!q.skillId) {
        const mode = q.visual.mode;
        q.skillId = `first.${mode === 'choice-grid' ? 'fractions-identify' : mode === 'single' ? 'fractions-name' : mode === 'equal-shares' ? 'fractions-equal' : mode === 'compare' ? 'fractions-compare' : mode === 'number-line' ? 'fractions-numberline' : 'fractions-stories'}`;
      }
      questions.push(q);
    } catch (err) {
      // Never leave the practice screen with an empty/invalid question.
      const fallback = genFractionName(1);
      fallback.skillId = 'first.fractions-name';
      questions.push(fallback);
    }
  }
  return questions;
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
    fractions: [gen1Fractions, genFractionIdentify, genFractionName, genFractionEqualShares, genFractionCompare, genFractionNumberLine, genFractionStory]
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

function generateQuestion(grade, topic, difficulty = 1, targetSkill = null) {
  if (targetSkill) {
    const direct = {
      'first.fractions-identify': genFractionIdentify, 'first.fractions-name': genFractionName,
      'first.fractions-equal': genFractionEqualShares, 'first.fractions-compare': genFractionCompare,
      'first.fractions-numberline': genFractionNumberLine, 'first.fractions-stories': genFractionStory,
      'kindergarten.numbers-recognition': genKGNumberRecognition, 'kindergarten.numbers-missing': genKGMissingNumber,
      'kindergarten.counting': genKGCounting, 'kindergarten.addition': genKGAddition, 'kindergarten.subtraction': genKGSubtraction,
      'kindergarten.shapes': genKGShapes, 'first.addition': gen1Add, 'first.subtraction': gen1Sub,
      'first.placevalue': gen1PlaceValue, 'first.counting': gen1Counting, 'first.time': gen1Time,
      'second.addition': gen2Add, 'second.subtraction': gen2Sub, 'second.placevalue': gen2PlaceValue,
      'second.money': gen2Money, 'second.time': gen2Time, 'second.measurement': gen2Measurement, 'second.equalgroups': gen2EqualGroups
    };
    const fn = direct[targetSkill] || direct[`${grade}.${targetSkill}`];
    if (fn) { const q = fn(difficulty); q.skillId = targetSkill; return q; }
  }
  const gens = GENERATORS[grade] && GENERATORS[grade][topic];
  if (!gens || gens.length === 0) return genKGNumberRecognition(1);
  const gen = gens[randInt(0, gens.length - 1)];
  const q = gen(difficulty);
  if (!q.skillId) {
    if (grade === 'first' && topic === 'fractions') {
      const mode = q.visual && q.visual.mode;
      q.skillId = `first.${mode === 'choice-grid' ? 'fractions-identify' : mode === 'single' ? 'fractions-name' : mode === 'equal-shares' ? 'fractions-equal' : mode === 'compare' ? 'fractions-compare' : mode === 'number-line' ? 'fractions-numberline' : 'fractions-stories'}`;
    } else if (grade === 'kindergarten' && topic === 'numbers') q.skillId = `kindergarten.${q.type === 'missing-number' ? 'numbers-missing' : 'numbers-recognition'}`;
    else q.skillId = skillKey(grade, topic);
  }
  return q;
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

function FractionVisual({ type, mode = 'simple', label }) {
  const value = ({ whole: 1, half: 0.5, quarter: 0.25, 'three-quarters': 0.75 })[type] || 0.5;
  // Pie (simple) always uses 4 equal slices so half = 2/4, whole = 4/4, etc.
  const pieShaded = Math.round(value * 4);
  // Bars use natural parts (2 for halves, 4 for quarters)
  const barParts = type === 'quarter' || type === 'three-quarters' ? 4 : 2;
  const barShaded = Math.round(value * barParts);
  if (mode === 'number-line') {
    return (
      <div className="w-64 mx-auto py-4">
        <div className="relative h-12 border-b-4 border-gray-700">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="absolute bottom-0 w-1 h-6 bg-gray-700" style={{ left: `${i * 25}%` }} />)}
          <div className="absolute bottom-2 w-5 h-5 rounded-full bg-red-500 border-2 border-red-700" style={{ left: `${value * 100}%`, transform: 'translateX(-50%)' }} />
        </div>
        <div className="flex justify-between font-bold mt-2"><span>0</span><span>1</span></div>
      </div>
    );
  }
  if (mode === 'bars') {
    return <div className="w-40 h-20 mx-auto border-4 border-gray-700 flex">{Array.from({ length: barParts }, (_, i) => <div key={i} className={'flex-1 border-r-2 border-gray-700 ' + (i < barShaded ? 'bg-blue-400' : 'bg-white')} />)}</div>;
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-28 h-28 rounded-full border-4 border-gray-700 overflow-hidden grid grid-cols-2 grid-rows-2">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={'border border-gray-500 ' + (i < pieShaded ? 'bg-orange-400' : 'bg-white')} />)}
      </div>
      {label && <span className="font-bold">{label}</span>}
    </div>
  );
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
  const transitionTimer = useRef(null);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

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
    if (transitionTimer.current) { clearTimeout(transitionTimer.current); transitionTimer.current = null; }
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
      transitionTimer.current = setTimeout(() => { transitionTimer.current = null; onAnswer(true, attempts + 1); }, 1000);
    } else {
      const msgs = attempts === 0 ? ['Almost! Try again 😊', "Not quite. Let's try again!", 'Close! Give it another try!'] : ["Let's try it together!", 'Here is a hint to help!'];
      setFeedback(msgs[Math.min(attempts, msgs.length - 1)]);
      if (attempts >= 1) setShowHint(true);
      speak(audioEnabled ? 'Almost, try again!' : '', audioEnabled);
      transitionTimer.current = setTimeout(() => { transitionTimer.current = null; setShowResult(false); setSelected(null); }, 1200);
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
      const v = question.visual || {};
      if (v.mode === 'compare') {
        return (
          <div className="flex flex-wrap justify-center gap-8 mt-4">
            {[['left', v.left], ['right', v.right]].map(([side, f]) => (
              <button key={side} type="button" onClick={() => handleSelect(side)} className={'btn-big p-5 shadow-lg border-4 ' + (selected === side ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white')}>
                <FractionVisual type={f} />
                <span className="block mt-2 font-bold capitalize">{side}</span>
              </button>
            ))}
          </div>
        );
      }
      if (v.mode === 'equal-shares') {
        return (
          <div className="flex flex-col items-center gap-5 mt-4">
            <div className="flex justify-center gap-6">
              {/* When equal: both halves. When unequal: half vs quarter so shares look different. */}
              <FractionVisual type="half" mode="bars" />
              <FractionVisual type={v.equal ? 'half' : 'quarter'} mode="bars" />
            </div>
            <div className="flex gap-4">
              {question.options.map((opt) => (
                <button key={opt} type="button" onClick={() => handleSelect(opt)} className={'btn-big px-8 shadow-lg border-4 ' + (selected === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white')}>
                  {opt === 'yes' ? '✅ Yes' : '❌ No'}
                </button>
              ))}
            </div>
          </div>
        );
      }
      if (v.mode === 'number-line') {
        return (
          <div className="flex flex-col items-center gap-5 mt-4">
            <FractionVisual type={v.target} mode="number-line" />
            <div className="flex flex-wrap justify-center gap-4">
              {question.options.map((f) => (
                <button key={f} type="button" onClick={() => handleSelect(f)} className={'btn-big px-5 shadow-lg border-4 ' + (selected === f ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white')}>
                  {fractionLabel(f)}
                </button>
              ))}
            </div>
          </div>
        );
      }
      if (v.mode === 'story') {
        return (
          <div className="flex flex-col items-center gap-5 mt-4">
            <div className="text-7xl text-center my-2" aria-hidden="true">{v.emoji}</div>
            <div className="flex flex-wrap justify-center gap-4">
              {question.options.map((f) => (
                <button key={f} type="button" onClick={() => handleSelect(f)} className={'btn-big px-5 shadow-lg border-4 ' + (selected === f ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white')}>
                  {fractionLabel(f)}
                </button>
              ))}
            </div>
          </div>
        );
      }
      if (v.mode === 'single') {
        // Naming Fractions: show the target picture, then text options
        return (
          <div className="flex flex-col items-center gap-5 mt-4">
            <FractionVisual type={v.target} />
            <div className="flex flex-wrap justify-center gap-4">
              {question.options.map((f) => (
                <button key={f} type="button" onClick={() => handleSelect(f)} className={'btn-big px-5 shadow-lg border-4 ' + (selected === f ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white')}>
                  {fractionLabel(f)}
                </button>
              ))}
            </div>
          </div>
        );
      }
      // choice-grid (identify): pick which picture matches the target fraction
      return (
        <div className="flex flex-wrap justify-center gap-5 mt-4">
          {question.options.map((f) => (
            <button key={f} type="button" onClick={() => handleSelect(f)} className={'btn-big p-4 shadow-lg border-4 ' + (selected === f ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white')}>
              <FractionVisual type={f} />
              <span className="block mt-2 font-bold capitalize">{fractionLabel(f)}</span>
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
            {question.type === 'fractions' && <p>Fractions describe equal shares. Two equal shares make halves; four equal shares make fourths.</p>}
            {!['visual-addition','visual-subtraction','counting','place-value','place-value-value','time','fractions'].includes(question.type) && <p>Look carefully and choose the best answer!</p>}
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
  const stats = getTotalStats(progress);
  const gradeNames = { kindergarten: 'Kindergarten', first: '1st Grade', second: '2nd Grade' };
  const currentGrade = progress.selectedGrade;
  return (
    <div className="min-h-screen p-4 md:p-6 flex flex-col items-center">
      <header className="text-center mb-6 mt-3">
        <div className="text-5xl mb-2 animate-bounce-slow">🧠✨</div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-800 mb-2">Math Fun!</h1>
        <p className="text-xl md:text-2xl text-gray-600">Learn • Practice • Earn Stars</p>
      </header>

      <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        <div className="bg-white/90 rounded-2xl p-4 text-center shadow"><div className="text-3xl">⭐</div><div className="text-2xl font-bold">{progress.stars || 0}</div><div className="text-sm text-gray-500">Stars</div></div>
        <div className="bg-white/90 rounded-2xl p-4 text-center shadow"><div className="text-3xl">🎯</div><div className="text-2xl font-bold">{stats.accuracy}%</div><div className="text-sm text-gray-500">Accuracy</div></div>
        <div className="bg-white/90 rounded-2xl p-4 text-center shadow"><div className="text-3xl">🔥</div><div className="text-2xl font-bold">{progress.currentStreak || 0}</div><div className="text-sm text-gray-500">Best streak</div></div>
        <div className="bg-white/90 rounded-2xl p-4 text-center shadow"><div className="text-3xl">📅</div><div className="text-2xl font-bold">{progress.dailyStreak || 0}</div><div className="text-sm text-gray-500">Daily streak</div></div>
      </div>

      <div className="w-full max-w-5xl mb-5 flex flex-wrap gap-3 justify-center">
        <button type="button" onClick={onDaily} className="btn-big bg-yellow-300 hover:bg-yellow-400 text-gray-800 px-7 shadow-lg">📅 Daily Challenge</button>
        {currentGrade && <button type="button" onClick={() => onSelectGrade(currentGrade)} className="btn-big bg-green-400 hover:bg-green-500 text-white px-7 shadow-lg">▶ Continue {gradeNames[currentGrade]}</button>}
        {currentGrade && <button type="button" onClick={() => onSelectGrade(currentGrade, true)} className="btn-big bg-pink-400 hover:bg-pink-500 text-white px-7 shadow-lg">🎯 Smart Practice</button>}
      </div>

      <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">Choose your grade</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full mb-8">
        {[
          { id: 'kindergarten', name: 'Kindergarten', color: 'bg-green-400', emoji: '🟢', desc: 'Numbers • Counting • Shapes' },
          { id: 'first', name: '1st Grade', color: 'bg-blue-400', emoji: '🔵', desc: 'Addition • Time • Fractions' },
          { id: 'second', name: '2nd Grade', color: 'bg-purple-400', emoji: '🟣', desc: 'Place Value • Money • Groups' }
        ].map(g => (
          <button key={g.id} type="button" onClick={() => onSelectGrade(g.id)}
            className={'card-grade ' + g.color + ' rounded-3xl p-7 shadow-xl border-4 border-white text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500'}>
            <div className="text-5xl mb-3">{g.emoji}</div>
            <h2 className="text-3xl font-bold text-white mb-2">{g.name}</h2>
            <p className="text-white/90 text-lg">{g.desc}</p>
            {progress.selectedGrade === g.id && <div className="mt-3 text-white font-bold">✓ Your current grade</div>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onProgress} className="btn-big bg-white hover:bg-gray-50 text-gray-800 px-7 shadow-lg">⭐ My Progress</button>
        <button type="button" onClick={onParent} className="btn-big bg-gray-200 hover:bg-gray-300 text-gray-700 px-7 shadow-lg">👨‍👩‍👧 Parent</button>
      </div>
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
  const [length, setLength] = useState(10);
  return (
    <div className="min-h-screen p-6 flex flex-col items-center justify-center relative">
      <button type="button" onClick={onBack} className="absolute top-6 left-6 btn-big bg-white shadow px-6">← Back</button>
      <div className="text-6xl mb-3">🎯</div>
      <h1 className="text-4xl font-bold mb-2 text-gray-800 text-center">{topicName}</h1>
      <p className="text-xl text-gray-600 mb-7 text-center">How many questions do you want?</p>
      <div className="grid grid-cols-3 gap-3 mb-8 w-full max-w-xl">
        {[5, 10, 20].map(n => (
          <button key={n} type="button" onClick={() => setLength(n)}
            className={'btn-big py-5 text-2xl shadow ' + (length === n ? 'bg-blue-500 text-white border-blue-700 scale-105' : 'bg-white border-gray-200')}>
            {n}<span className="block text-sm">questions</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-5">
        <button type="button" onClick={onLearn} className="btn-big bg-sky-400 hover:bg-sky-500 text-white px-10 py-6 text-2xl shadow-xl">📚 Learn First</button>
        <button type="button" onClick={() => onPractice(length)} className="btn-big bg-green-400 hover:bg-green-500 text-white px-10 py-6 text-2xl shadow-xl">🚀 Start Practice</button>
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

function PracticeSession({ grade, topic, targetSkill, dailyQuestions, sessionLength = 10, onFinish, onBack, audioEnabled, progress, setProgress }) {
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [difficulty, setDifficulty] = useState(1);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showStar, setShowStar] = useState(false);
  const totalQuestions = dailyQuestions ? dailyQuestions.length : sessionLength;

  // Only re-generate when the session parameters change — NOT when progress updates
  // after every answer (that would reset the whole round and feel "stuck").
  useEffect(() => {
    const startingDifficulty = getAdaptiveDifficulty(progress, grade, topic);
    setIdx(0); setCorrectCount(0); setDifficulty(startingDifficulty); setStreak(0); setBestStreak(0); setShowStar(false);
    if (dailyQuestions) {
      setQuestions(dailyQuestions);
    } else if (grade === 'first' && topic === 'fractions') {
      setQuestions(generateFractionPractice(totalQuestions, startingDifficulty, targetSkill));
    } else {
      const generated = [];
      for (let i = 0; i < totalQuestions; i++) {
        try {
          const q = generateQuestion(grade, topic, startingDifficulty, targetSkill);
          if (!q) throw new Error('Question generation returned nothing');
          generated.push(q);
        } catch (err) {
          generated.push(generateQuestion('kindergarten', 'numbers', 1));
        }
      }
      setQuestions(generated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- progress is intentionally omitted so answering does not restart the session
  }, [grade, topic, targetSkill, dailyQuestions, sessionLength]);

  const current = questions[idx];

  const handleAnswer = (correct, attempts) => {
    const newProgress = JSON.parse(JSON.stringify(progress));
    if (!newProgress.topics) newProgress.topics = {};
    if (!newProgress.topics[topic]) newProgress.topics[topic] = { correct: 0, attempts: 0 };
    newProgress.topics[topic].attempts += 1;
    const skillId = (questions[idx] && questions[idx].skillId) || targetSkill || topic;
    if (!newProgress.skills) newProgress.skills = {};
    if (!newProgress.skills[skillId]) newProgress.skills[skillId] = { correct: 0, attempts: 0 };
    newProgress.skills[skillId].attempts += 1;

    const nextStreak = correct ? streak + 1 : 0;
    const nextBest = Math.max(bestStreak, nextStreak);
    setBestStreak(nextBest);

    if (correct) {
      newProgress.topics[topic].correct += 1;
      newProgress.skills[skillId].correct += 1;
      newProgress.stars = (newProgress.stars || 0) + 1;
      setCorrectCount(c => c + 1);
      setStreak(nextStreak);
      setShowStar(true);
      if (nextStreak >= 3) setDifficulty(d => Math.min(3, d + 1));
    } else {
      setStreak(0);
      if (attempts >= 2) setDifficulty(d => Math.max(1, d - 1));
    }

    if (nextBest > (newProgress.bestStreak || 0)) newProgress.bestStreak = nextBest;

    if (dailyQuestions && correct) {
      const today = getTodayKey();
      if (newProgress.lastDaily !== today) {
        const previous = newProgress.lastDaily;
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
        newProgress.dailyStreak = previous === yesterdayKey ? (newProgress.dailyStreak || 0) + 1 : 1;
        newProgress.lastDaily = today;
      }
    }

    newProgress.history = ((newProgress.history || []).slice(-149)).concat([{ grade, topic, skill: skillId, correct, time: Date.now() }]);
    BADGE_DEFS.forEach(b => {
      if (!(newProgress.badges || []).includes(b.id) && b.condition(Object.assign({}, newProgress, { currentStreak: nextStreak }))) {
        newProgress.badges = (newProgress.badges || []).concat([b.id]);
      }
    });
    setProgress(newProgress);

    if (idx + 1 >= questions.length) {
      setTimeout(() => onFinish(correctCount + (correct ? 1 : 0), questions.length), 850);
    } else {
      setTimeout(() => {
        const nextIndex = idx + 1;
        setQuestions(prev => {
          const copy = [...prev];
          if (!dailyQuestions) copy[nextIndex] = generateQuestion(grade, topic, Math.min(3, difficulty + (correct ? 1 : 0)), targetSkill);
          return copy;
        });
        setIdx(nextIndex);
      }, 850);
    }
  };

  if (!current) return <div className="min-h-screen flex items-center justify-center"><p className="text-2xl">Loading questions...</p></div>;

  return (
    <React.Fragment>
      <StarReward show={showStar} onDone={() => setShowStar(false)} />
      <div className="pt-2"><ProgressBar current={idx + 1} total={questions.length} /></div>
      <div className="text-center text-base font-bold text-gray-600 mt-2 mb-1">🔥 Streak: {streak} &nbsp; • &nbsp; ⭐ {correctCount} &nbsp; • &nbsp; Level {difficulty}</div>
      <ActivityScreen question={current} onAnswer={handleAnswer} onBack={onBack} audioEnabled={audioEnabled} />
    </React.Fragment>
  );
}

function ResultsScreen({ correct, total, onHome, onAgain }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  let message = 'Keep going! Every question makes you stronger. 💪';
  let emoji = '🌱';
  if (pct === 100) { message = 'PERFECT! You are a math superstar! 🌟'; emoji = '🏆'; }
  else if (pct >= 80) { message = 'Amazing work! You are on fire! 🔥'; emoji = '🌟'; }
  else if (pct >= 60) { message = 'Great job! Keep practicing! 🎉'; emoji = '🥳'; }
  const stars = Math.max(1, Math.min(5, Math.ceil(pct / 20)));
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-8xl mb-3 animate-bounce-slow">{emoji}</div>
      <h1 className="text-4xl md:text-5xl font-bold mb-3 text-center">{message}</h1>
      <div className="bg-white rounded-3xl shadow-xl p-7 max-w-lg w-full text-center">
        <p className="text-3xl mb-2">You got <span className="text-green-600 font-bold">{correct}</span> out of {total}</p>
        <p className="text-xl text-gray-600 mb-4">{pct}% correct</p>
        <div className="text-6xl mb-5" aria-label={`${stars} stars`}>{'⭐'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
        <div className="bg-blue-50 rounded-2xl p-4 text-lg mb-6">
          {pct >= 80 ? '🎁 You earned a great practice reward!' : '💡 Try again and see if you can beat your score!'}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button type="button" onClick={onAgain} className="btn-big bg-green-400 hover:bg-green-500 text-white px-8">🚀 Practice Again</button>
          <button type="button" onClick={onHome} className="btn-big bg-white shadow px-8">🏠 Home</button>
        </div>
      </div>
    </div>
  );
}

function LearningMap({ progress, grade, onPractice }) {
  const map = LEARNING_MAP[grade] || [];
  const gradeName = { kindergarten:'Kindergarten', first:'1st Grade', second:'2nd Grade' }[grade];
  return <div className="bg-white rounded-3xl p-5 shadow-xl mb-6">
    <h2 className="text-2xl font-bold mb-1">🗺️ {gradeName} Learning Map</h2>
    <p className="text-gray-600 mb-4">Master a skill to unlock the next step. Mastery = 80%+ after at least 5 questions.</p>
    <div className="space-y-3">
      {map.map((n, i) => {
        const st=getSkillStats(progress, skillKey(grade,n.skill)); const pct=getSkillAccuracy(progress, skillKey(grade,n.skill));
        const mastered=isSkillMastered(progress,grade,n.skill); const unlocked=isSkillUnlocked(progress,grade,n.skill);
        return <div key={n.skill} className={'rounded-2xl p-4 border-2 '+(mastered?'bg-green-50 border-green-200':unlocked?'bg-blue-50 border-blue-200':'bg-gray-100 border-gray-200')}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">{mastered?'✅':unlocked?'🔓':'🔒'}</div>
            <div className="flex-1"><div className="font-bold">{i+1}. {n.icon} {n.title}</div><div className="text-sm text-gray-500">{st.attempts?`${pct}% • ${st.correct}/${st.attempts} correct`:'Not started'}</div></div>
            {unlocked && !mastered && <button type="button" onClick={()=>onPractice(skillKey(grade,n.skill))} className="btn-big bg-green-400 text-white px-4 py-2 text-base">Practice</button>}
          </div>
          <div className="h-2 bg-gray-200 rounded-full mt-3 overflow-hidden"><div className="h-full bg-green-400" style={{width:(st.attempts?Math.max(4,pct):0)+'%'}} /></div>
        </div>;
      })}
    </div>
  </div>;
}

function ProgressScreen({ progress, onBack }) {
  const topics = progress.topics || {};
  return (
    <div className="min-h-screen p-6">
      <button type="button" onClick={onBack} className="btn-big bg-white shadow mb-6 px-6">← Back</button>
      <h1 className="text-4xl font-bold text-center mb-8">⭐ My Progress</h1>
      <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 shadow-xl">
        {(() => { const s = getTotalStats(progress); return <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-center">
          <div className="bg-yellow-50 rounded-2xl p-3"><div className="text-2xl">⭐</div><strong>{progress.stars || 0}</strong><div className="text-xs">Stars</div></div>
          <div className="bg-green-50 rounded-2xl p-3"><div className="text-2xl">🎯</div><strong>{s.accuracy}%</strong><div className="text-xs">Accuracy</div></div>
          <div className="bg-orange-50 rounded-2xl p-3"><div className="text-2xl">🔥</div><strong>{progress.bestStreak || 0}</strong><div className="text-xs">Best streak</div></div>
          <div className="bg-blue-50 rounded-2xl p-3"><div className="text-2xl">📅</div><strong>{progress.dailyStreak || 0}</strong><div className="text-xs">Daily streak</div></div>
        </div>; })()}
        <p className="text-xl text-center mb-6">Badges earned: {(progress.badges || []).length}</p>
        {progress.selectedGrade && (() => {
          const recommendedSkill = getRecommendedSkill(progress, progress.selectedGrade);
          const meta = getSkillMeta(progress.selectedGrade, recommendedSkill);
          return meta ? (
            <div className="bg-pink-50 border-2 border-pink-200 rounded-2xl p-5 mb-6 text-center">
              <div className="text-3xl mb-1">🎯</div>
              <h3 className="text-xl font-bold">Your next practice skill</h3>
              <p className="text-lg">{meta.icon} {meta.name}</p>
              <p className="text-sm text-gray-600 mt-1">Math Fun looks at each skill separately and sends extra practice where it is needed.</p>
            </div>
          ) : null;
        })()}
        {progress.selectedGrade && <LearningMap progress={progress} grade={progress.selectedGrade} onPractice={(skill) => onBack("practice:"+skill)} />}
        <div className="space-y-3">
          {Object.entries(topics).map(([id, stats]) => (
            <div key={id} className="flex justify-between items-center bg-gray-50 rounded-xl p-3">
              <span className="font-bold capitalize text-lg">{id}</span>
              <span>{'⭐'.repeat(Math.min(5, Math.floor((stats.correct || 0) / 3)))}<span className="text-sm text-gray-500 ml-2">{stats.correct || 0} correct</span></span>
            </div>
          ))}
          {Object.keys(topics).length === 0 && <p className="text-center text-gray-500">Start practicing to see progress!</p>}
        </div>
        {progress.selectedGrade && <div className="mt-6">
          <h3 className="font-bold text-xl mb-3">🧠 Skill Mastery</h3>
          <div className="space-y-2">
            {(SKILL_CATALOG[progress.selectedGrade] || []).map(s => { const id=skillKey(progress.selectedGrade,s[0]); const st=getSkillStats(progress,id); const pct=getSkillAccuracy(progress,id); return <div key={s[0]} className="bg-gray-50 rounded-xl p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{s[2]} {s[1]}</span><span className="font-bold">{st.attempts ? pct+'%' : 'New'}</span></div><div className="h-3 bg-gray-200 rounded-full mt-2 overflow-hidden"><div className="h-full bg-green-400" style={{width:(st.attempts ? Math.max(8,pct) : 3)+'%'}} /></div><div className="text-xs text-gray-500 mt-1">{st.correct || 0} correct of {st.attempts || 0}</div></div> })}
          </div>
        </div>}
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
          {progress.selectedGrade ? (() => {
            const recommendedSkill = getRecommendedSkill(progress, progress.selectedGrade);
            const meta = getSkillMeta(progress.selectedGrade, recommendedSkill);
            return meta ? <p className="text-gray-700">Recommended next: <strong>{meta.icon} {meta.name}</strong>. Math Fun prioritizes the individual skills with lower accuracy or recent misses.</p> : <p>Keep practicing all topics!</p>;
          })() : <p className="text-gray-700">Choose a grade to enable adaptive recommendations.</p>}
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
  const [targetSkill, setTargetSkill] = useState(null);
  const [dailyQs, setDailyQs] = useState(null);
  const [results, setResults] = useState({ correct: 0, total: 0 });
  const [audioEnabled, setAudioEnabled] = useState(progress.settings && progress.settings.audio !== false);
  const [practiceLength, setPracticeLength] = useState(10);

  useEffect(() => { saveProgress(progress); }, [progress]);

  const selectGrade = (g, smart = false) => {
    setGrade(g);
    setProgress(p => Object.assign({}, p, { selectedGrade: g }));
    if (smart) {
      const skill = getRecommendedSkill(progress, g);
      const meta = getSkillMeta(g, skill);
      setTargetSkill(skill);
      setTopic(meta ? meta.topic : getRecommendedTopic(progress, g));
      setScreen('mode');
    } else {
      setTargetSkill(null);
      setScreen('topics');
    }
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
      {screen === 'topics' && <TopicScreen grade={grade} progress={progress} onSelectTopic={(t) => { setTopic(t); setTargetSkill(null); setScreen('mode'); }} onBack={() => setScreen('home')} />}
      {screen === 'mode' && <ModeSelect topicName={topicName} onLearn={() => setScreen('learn')} onPractice={(n) => { setPracticeLength(n || 10); setDailyQs(null); setScreen('practice'); }} onBack={() => setScreen('topics')} />}
      {screen === 'learn' && <LearnScreen grade={grade} topic={topic} onBack={() => setScreen('mode')} onStartPractice={() => { setDailyQs(null); setScreen('practice'); }} />}
      {screen === 'practice' && <PracticeSession grade={grade} topic={topic === 'daily' ? 'addition' : topic} targetSkill={topic === 'daily' ? null : targetSkill} dailyQuestions={dailyQs} sessionLength={practiceLength} onFinish={finishPractice} onBack={() => setScreen(dailyQs ? 'home' : 'mode')} audioEnabled={audioEnabled} progress={progress} setProgress={setProgress} />}
      {screen === 'results' && <ResultsScreen correct={results.correct} total={results.total} onHome={() => setScreen('home')} onAgain={() => { setPracticeLength(10); setDailyQs(null); setScreen('practice'); }} />}
      {screen === 'progress' && <ProgressScreen progress={progress} onBack={(action) => { if (typeof action === 'string' && action.startsWith('practice:')) { const skill=action.slice(9); const g=grade || progress.selectedGrade; const meta=getSkillMeta(g,skill); setGrade(g); setTargetSkill(skill); setTopic(meta ? meta.topic : null); setPracticeLength(10); setDailyQs(null); setScreen('practice'); } else setScreen('home'); }} />}
      {screen === 'parentgate' && <ParentGate onSuccess={() => setScreen('parent')} onCancel={() => setScreen('home')} />}
      {screen === 'parent' && <ParentDashboard progress={progress} onBack={() => setScreen('home')} onReset={() => { if (confirm('Reset all progress?')) { const fresh = loadProgress(); fresh.selectedGrade = progress.selectedGrade; setProgress(fresh); saveProgress(fresh); } }} onToggleAudio={() => { setAudioEnabled(a => { const next = !a; setProgress(p => Object.assign({}, p, { settings: Object.assign({}, p.settings, { audio: next }) })); return next; }); }} audioEnabled={audioEnabled} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
