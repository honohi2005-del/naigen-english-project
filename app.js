(() => {
  'use strict';
  const items = window.MAXIMS || [];
  const audioRevisionsPromise = fetch('./audio/manifest.json', { cache: 'no-cache' })
    .then(response => response.ok ? response.json() : null)
    .then(manifest => Object.fromEntries((manifest?.assets || []).map(asset => [Number(asset.id), asset.revision])))
    .catch(() => ({}));
  const audioIdOf = item => Number(item.audioId ?? item.id);
  const sourceOrderOf = item => item.sourceImage == null || item.sourceImage === '' || !Number.isFinite(Number(item.sourceImage)) ? Number.POSITIVE_INFINITY : Number(item.sourceImage);
  const sourceImages = items.map(sourceOrderOf).filter(Number.isFinite);
  const maxSourceImage = sourceImages.length ? Math.max(...sourceImages) : 0;
  const orderedItems = [...items].sort((a, b) => Number(a.id) - Number(b.id));
  const sourceOrderedItems = [...items].sort((a, b) => sourceOrderOf(a) - sourceOrderOf(b) || Number(a.id) - Number(b.id));
  const $ = (id) => document.getElementById(id);
  const ui = {
    practiceScreen: $('practice-screen'), libraryScreen: $('library-screen'), practiceScreenTab: $('practice-screen-tab'), libraryScreenTab: $('library-screen-tab'), libraryCount: $('library-count'), libraryResultCount: $('library-result-count'), librarySearch: $('library-search'), libraryList: $('library-list'), libraryEmpty: $('library-empty'),
    total: $('total-count'), tabs: [...document.querySelectorAll('.mode-tab')], randomPicker: $('random-picker'), randomPlay: $('random-play'), orderedPlay: $('ordered-play'), numberedPlay: [...document.querySelectorAll('[data-start-number]')], picker: $('topic-picker'), topic: $('topic-select'), topicPlay: $('topic-play'), topicCount: $('topic-count'),
    topicSpeechButtons: $('topic-speech-buttons'), topicSpeechCard: $('topic-speech-card'), topicSpeechTitle: $('topic-speech-title'), topicSpeechText: $('topic-speech-text'), topicSpeechWordCount: $('topic-speech-word-count'), topicSpeechGenerate: $('topic-speech-generate'), topicSpeechPlay: $('topic-speech-play'), topicSpeechStatus: $('topic-speech-status'),
    modeLabel: $('mode-label'), number: $('item-number'), topicLabel: $('item-topic'), source: $('source-page'), en: $('english-quote'), enJa: $('english-japanese'), speak: $('speak-button'), pause: $('pause-button'), modelSpeed: $('model-speed'), repeatTwice: $('repeat-twice'), modelLoop: $('model-loop-button'), speechStatus: $('speech-status'), previous: $('previous-button'), previousTen: $('previous-ten-button'), previousFifty: $('previous-fifty-button'), next: $('next-button'), orderedNext: $('ordered-next-button'), nextTen: $('next-ten-button'), nextFifty: $('next-fifty-button'),
    series: $('series-bar'), seriesStatus: $('series-status'), stop: $('series-stop'), record: $('record-button'), recordStatus: $('record-status'), recordList: $('record-list'), recordAll: $('record-play-all'), recordTrio: $('record-model-trio'), recordClear: $('record-delete-all'), recordCount: $('record-count'), install: $('install-button')
  };
  let mode = 'random', current = null, series = null, seriesTimer = null, quoteAudio = null, quotePlaybackActive = false, speechVersion = 0, recorder = null, recordingParts = [], recordStream = null, allRecords = [], playbackQueue = [], playbackAudio = null, recordPlaybackRun = null, trioPlayback = null, recordObjectUrls = [], installPrompt = null, recordingStarting = false, recordSavePending = false, recordDeletionPending = false;
  let randomHistory = [], randomHistoryPos = -1;
  let topicSpeechActive = false, topicSpeechVersion = 0;
  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let modelPlaybackRate = 1;
  let dbPromise;
  const functionWords = new Set(`a an the i me my you your yourself we our ourselves they them their themselves he him his she her it its this that these those who whom whose which what when where why how another each every either neither all no any some as at by for from in into of on onto out over under with within without after before against between beyond through to than like and or but so because if while although though unless until whether then instead rather not do does did can cannot could may might must shall should will would am is are was were be been being has had ought`.split(' '));
  const topicSpeechSets = {
    '意味と思索': [
      ['Meaning often emerges through experience before I can explain clearly what has changed inside me.', 'An idea becomes meaningful when it meets daily life and alters the way I notice things.', 'I do not always discover meaning by thinking harder; sometimes patient attention reveals what reasoning misses.'],
      ['When I pause before judging, unfamiliar details can connect with memories and reveal questions worth exploring further.', 'A conversation may change my view because another person makes an assumption visible that I had overlooked.', 'The world rarely offers a complete answer, but it gives me material for a more careful question.'],
      ['Uncertainty can feel uncomfortable, yet it keeps one interpretation from closing every other path too soon.', 'If I name an experience too quickly, I may miss its changing details and reduce its complexity.', 'I try to remain curious when my first explanation feels convincing, because confidence can hide important evidence.'],
      ['By letting ideas change through contact with the world, I can think deeply without demanding certainty.', 'This practice does not remove difficulty; it helps me meet complexity without pretending everything is settled.', 'Meaning grows through these encounters, giving my life direction while leaving room for questions to continue.']
    ],
    '学びと思考': [
      ['Learning develops when I test an idea, notice the result, and adjust my understanding through experience.', 'Progress begins when I treat mistakes as information rather than proof that I cannot improve.', 'A useful lesson gives me a question to explore, not merely an answer to remember and repeat.'],
      ['Practice becomes more effective when I receive feedback, observe its effect, and try the skill again.', 'Watching others can reveal details written instructions miss, especially when I compare their actions with my own.', 'I need time alone to connect new ideas with situations that matter in my everyday life.'],
      ['Confusion does not always signal failure; it can show where my current explanation needs further attention.', 'If I stop after an attempt, I lose the chance to discover an approach that suits me better.', "A learner's progress depends partly on whether the environment makes experimentation safe and worthwhile over time."],
      ['Skills become reliable when attention can move beyond basic steps toward fresh challenges and relationships.', 'The purpose of education is not simply arrival; it is learning to travel with different perspectives.', 'I learn more deeply when I take responsibility for exploring, while using support from teachers and peers.']
    ],
    '行動と内省': [
      ['Before moving, I can notice the habit shaping my response and decide whether it fits this moment.', 'A brief pause gives my body time to release tension and register what the person is doing.', 'I make better choices when I observe my reactions without expecting perfect control over each outcome.'],
      ['Experiments help me learn because each change produces evidence I can use to adjust my next action.', 'Instead of forcing a result, I can stay attentive and respond to what develops around me.', 'When movement feels awkward, I can slow down, notice its cause, and try a different approach.'],
      ['Past habits provide comfort, but they may delay a response that requires attention to the present moment.', 'I cannot control every result, yet I can take responsibility for the next action I choose.', 'Reflection is useful when it guides a new attempt rather than becoming endless criticism of myself.'],
      ['Over time, repeated attention can make a more natural response available without conscious effort during practice.', 'That process is not instant, but each honest observation gives me a clearer place to begin again.', 'I keep moving forward by combining patience with the courage to test what I have noticed.']
    ],
    '発音と身体': [
      ['My voice is shaped by breath, posture, and attention before a single word reaches another person.', 'Speaking clearly begins with noticing the body, not with forcing every sound into perfect shape.', 'A relaxed voice can still be strong when its rhythm carries intention and leaves room for response.'],
      ['I exhale fully, take an easy breath, and begin speaking before tension gathers in my throat.', 'Listening to resonance in my body helps me notice where a sound feels open and supported.', 'Small adjustments to pace and volume can make speech easier to follow without making it feel controlled.'],
      ['Breath and silence shape a phrase together, giving listeners time to follow the meaning as it unfolds.', 'I do not need to push my voice toward someone; shared rhythm can invite attention more gently.', 'Practice helps me hear differences in sound, while patience keeps my body from tightening under pressure.'],
      ['When breath remains free, the voice can respond to another person instead of repeating one fixed pattern.', 'This way of speaking grows slowly through listening, experimenting, and noticing how each phrase affects others.', 'The goal is not a perfect sound, but a living voice that can adapt and remain clear.']
    ],
    '表現と学習': [
      ['An expressive style develops through practice, when familiar forms meet the needs of a particular moment.', 'A model can guide me, but copying it perfectly does not make the result meaningful for me.', 'Sometimes one precise gesture or pause reveals more than an explanation about what I intend to express.'],
      ['I study a form carefully, then notice which parts support the response I want to create.', 'A familiar action can become fresh when I listen to the audience and adjust my timing.', 'What looks repeated from outside may still generate new meaning as circumstances and relationships continue to change.'],
      ['If I focus only on displaying my skill, the expression may become predictable and lose its vitality.', 'Attending to another person gives my choices direction, because expression takes shape within a shared situation.', 'I can use limits creatively when I treat them as conditions for exploration rather than instructions to obey.'],
      ['Small and accurate actions help the whole performance feel truthful, even when the situation is imagined.', 'By combining attention with play, I can respond freely without losing the structure that supports my work.', 'The value of practice appears when a technique opens space for choices I could not make before.']
    ]
  };
  const topicSpeechHistory = new Map();

  function renderEnglish(text) {
    const fragment = document.createDocumentFragment();
    const parts = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*|[^A-Za-z]+/g) || [];
    for (const part of parts) {
      if (/^[A-Za-z]/.test(part) && !functionWords.has(part.toLowerCase())) {
        const word = document.createElement('span');
        word.className = 'content-word';
        word.textContent = part;
        fragment.append(word);
      } else {
        fragment.append(document.createTextNode(part));
      }
    }
    ui.en.replaceChildren(fragment);
  }

  function shuffled(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function shuffledAfter(list, previousId) {
    const queue = shuffled(list);
    if (queue.length > 1 && queue[0].id === previousId) {
      const swapIndex = queue.findIndex((item, index) => index > 0 && item.id !== previousId);
      if (swapIndex > 0) [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
    }
    return queue;
  }
  function topicItems() { return items.filter(item => item.topic === ui.topic.value); }
  function updatePreviousButton() {
    const historyMatchesCurrent = randomHistory[randomHistoryPos]?.id === current?.id;
    ui.previous.disabled = series?.type === 'model' || series?.type === 'ordered' || series?.type === 'numbered' || series?.type === 'topic'
      ? series.pos <= 1
      : !historyMatchesCurrent || randomHistoryPos <= 0;
  }
  function updateOrderedNextButton() {
    if (series?.type === 'numbered') { ui.orderedNext.disabled = series.pos >= series.queue.length; return; }
    const index = sourceOrderedItems.findIndex(item => item.id === current?.id);
    ui.orderedNext.disabled = index < 0 || index >= sourceOrderedItems.length - 1;
  }
  function stepNavigation() {
    const inSeriesQueue = series?.type === 'ordered' || series?.type === 'numbered';
    const queue = inSeriesQueue ? series.queue : sourceOrderedItems;
    return { queue, index: queue.findIndex(item => item.id === current?.id), inSeriesQueue };
  }
  function updateStepButtons() {
    const { index, queue } = stepNavigation();
    ui.previousTen.disabled = index < 10;
    ui.nextTen.disabled = index < 0 || index + 10 >= queue.length;
    ui.previousFifty.disabled = index < 50;
    ui.nextFifty.disabled = index < 0 || index + 50 >= queue.length;
  }
  function updateSeriesStatus() {
    if (!series) return;
    const repeatLabel = series.repeatCount === 2 ? '（各格言を2回）' : '';
    const position = `${series.pos} / ${series.queue.length}`;
    const label = { random: 'ランダム', ordered: '順番', numbered: '番号順', topic: 'トピック' }[series.type] || '連続';
    ui.seriesStatus.textContent = series.type === 'model'
      ? `モデル音声を連続再生中${repeatLabel} · ${position}`
      : `${label}連続再生${repeatLabel} · ${position}`;
  }
  function rememberRandom(item) {
    if (!item) return;
    if (randomHistoryPos < randomHistory.length - 1) randomHistory = randomHistory.slice(0, randomHistoryPos + 1);
    if (randomHistory.at(-1)?.id !== item.id) randomHistory.push(item);
    randomHistoryPos = randomHistory.length - 1;
    updatePreviousButton();
  }
  function renderItem(item) {
    if (!item) return;
    current = item;
    ui.number.textContent = `NO. ${String(item.id).padStart(3, '0')}`;
    ui.topicLabel.textContent = item.topicLabel || item.topic;
    ui.source.textContent = Number.isFinite(sourceOrderOf(item)) ? `出典画像 ${item.sourceImage} / ${maxSourceImage}（ZIP内のファイル名順）` : '出典画像なし';
    renderEnglish(item.en);
    ui.enJa.textContent = item.ja;
    ui.modeLabel.textContent = mode === 'topic' ? 'TOPIC PRACTICE' : 'RANDOM PRACTICE';
    renderCurrentRecords();
    updatePreviousButton();
    updateOrderedNextButton();
    updateStepButtons();
  }
  function updatePauseButton() {
    const canToggle = quotePlaybackActive && quoteAudio && !quoteAudio.ended;
    ui.pause.disabled = !canToggle;
    ui.pause.textContent = canToggle && quoteAudio.paused ? '再開' : '一時停止';
  }
  function stopTopicSpeech(message = '') {
    topicSpeechVersion++;
    if (topicSpeechActive && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    topicSpeechActive = false;
    ui.topicSpeechPlay.textContent = 'ブラウザ音声で読み上げ';
    if (message) ui.topicSpeechStatus.textContent = message;
  }
  function renderTopicSpeech(topic) {
    stopTopicSpeech();
    const speech = topicSpeechSets[topic] ? generateTopicSpeech(topic) : '';
    ui.topicSpeechCard.hidden = !speech;
    ui.topicSpeechTitle.textContent = topic || '';
    ui.topicSpeechText.textContent = speech || '';
    ui.topicSpeechWordCount.textContent = speech ? `${speech.trim().split(/\s+/).length} words · CEFR B2` : '';
    ui.topicSpeechStatus.textContent = '';
    ui.topicSpeechButtons.querySelectorAll('[data-speech-topic]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.speechTopic === topic));
    });
  }
  function generateTopicSpeech(topic) {
    const slots = topicSpeechSets[topic];
    if (!slots) return '';
    const combinations = slots.reduce((total, options) => total * options.length, 1);
    let used = topicSpeechHistory.get(topic);
    if (!used || used.size >= combinations) {
      used = new Set();
      topicSpeechHistory.set(topic, used);
    }
    let combination = Math.floor(Math.random() * combinations);
    while (used.has(combination)) combination = (combination + 1) % combinations;
    used.add(combination);

    const selections = Array(slots.length);
    let remainder = combination;
    for (let index = slots.length - 1; index >= 0; index--) {
      selections[index] = remainder % slots[index].length;
      remainder = Math.floor(remainder / slots[index].length);
    }
    const speech = slots.map((options, index) => options[selections[index]]).join(' ');
    const wordCount = speech.trim().split(/\s+/).length;
    if (wordCount < 60 || wordCount > 70) throw new Error(`Topic speech must be 60–70 words; received ${wordCount}.`);
    return speech;
  }
  function playTopicSpeech() {
    if (topicSpeechActive) { stopTopicSpeech('読み上げを停止しました。'); return; }
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      ui.topicSpeechStatus.textContent = 'このブラウザは音声読み上げに対応していません。';
      return;
    }
    const text = ui.topicSpeechText.textContent.trim();
    if (!text) return;
    stopSeries();
    const version = ++topicSpeechVersion;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.onend = () => {
      if (version !== topicSpeechVersion) return;
      topicSpeechActive = false;
      ui.topicSpeechPlay.textContent = 'もう一度読み上げる';
      ui.topicSpeechStatus.textContent = '読み上げが終わりました。';
    };
    utterance.onerror = () => {
      if (version !== topicSpeechVersion) return;
      topicSpeechActive = false;
      ui.topicSpeechPlay.textContent = 'ブラウザ音声で読み上げ';
      ui.topicSpeechStatus.textContent = 'ブラウザ音声を再生できませんでした。';
    };
    topicSpeechActive = true;
    ui.topicSpeechPlay.textContent = '読み上げを停止';
    ui.topicSpeechStatus.textContent = '英語スピーチを読み上げています…';
    window.speechSynthesis.speak(utterance);
  }
  function stopSpeech() {
    speechVersion++;
    quotePlaybackActive = false;
    if (!quoteAudio) { updatePauseButton(); return; }
    quoteAudio.onended = null;
    quoteAudio.onerror = null;
    quoteAudio.onplaying = null;
    quoteAudio.onpause = null;
    quoteAudio.pause();
    try { quoteAudio.currentTime = 0; } catch { /* The audio may not be ready yet. */ }
    updatePauseButton();
  }
  async function speakCurrent(onEnd) {
    stopTopicSpeech();
    if (!current) return;
    stopSpeech();
    const version = speechVersion;
    const revisions = await audioRevisionsPromise;
    if (version !== speechVersion) return;
    const audio = quoteAudio ||= new Audio();
    const audioId = audioIdOf(current);
    const revision = revisions[audioId];
    audio.src = `./audio/q${String(audioId).padStart(3, '0')}.mp3${revision ? `?v=${revision}` : ''}`;
    audio.playbackRate = modelPlaybackRate;
    audio.onplaying = () => {
      if (version !== speechVersion) return;
      quotePlaybackActive = true;
      updatePauseButton();
    };
    audio.onpause = () => {
      if (version === speechVersion) updatePauseButton();
    };
    audio.onended = () => {
      if (version !== speechVersion) return;
      quotePlaybackActive = false;
      updatePauseButton();
      ui.speechStatus.textContent = 'Gemini音声の再生が終わりました。';
      onEnd?.();
    };
    const fail = () => {
      if (version !== speechVersion) return;
      quotePlaybackActive = false;
      updatePauseButton();
      if (series || trioPlayback) stopSeries();
      ui.speechStatus.textContent = 'Gemini音声を再生できませんでした。通信状態をご確認ください。';
    };
    audio.onerror = fail;
    ui.speechStatus.textContent = 'Gemini音声を再生中…';
    audio.play().catch(fail);
  }
  function chooseRandom(list = items) { if (!list.length) return null; return list[Math.floor(Math.random() * list.length)]; }
  function startSeries(type, list) {
    if (!list.length) { ui.speechStatus.textContent = 'このモードに再生できる一文がありません。'; return; }
    const repeatCount = ui.repeatTwice.checked ? 2 : 1;
    if (type === 'model') {
      const pool = [...new Map(list.map(item => [item.id, item])).values()];
      if (pool.length < 2) { ui.speechStatus.textContent = '別の一文がないため、連続再生できません。'; return; }
      stopSeries();
      const first = pool.find(item => item.id === current?.id);
      const queue = first ? [first, ...shuffled(pool.filter(item => item.id !== first.id))] : shuffled(pool);
      series = { type, pool, queue, pos: 0, repeatCount, currentItemId: null, currentReadCount: 0 };
      ui.series.hidden = false;
      advanceSeries();
      return;
    }
    stopSeries();
    series = { type, queue: type === 'random' ? shuffledAfter(list, current?.id) : [...list], pos: 0, repeatCount, currentItemId: null, currentReadCount: 0 };
    ui.series.hidden = false;
    advanceSeries();
  }
  function scheduleNext(activeSeries) {
    if (series !== activeSeries) return;
    seriesTimer = window.setTimeout(() => {
      seriesTimer = null;
      if (series === activeSeries) advanceSeries();
    }, 550);
  }
  function advanceSeries(forceNext = false) {
    if (!series) return;
    window.clearTimeout(seriesTimer);
    seriesTimer = null;
    if (!forceNext && series.currentItemId === current?.id && series.currentReadCount < series.repeatCount) {
      series.currentReadCount++;
      updateSeriesStatus();
      const activeSeries = series;
      speakCurrent(() => scheduleNext(activeSeries));
      return;
    }
    if (series.type === 'random' && randomHistoryPos < randomHistory.length - 1) {
      current = randomHistory[++randomHistoryPos];
    } else {
      if (series.pos >= series.queue.length) {
        if (series.type === 'random') { series.queue = shuffledAfter(items, current?.id); series.pos = 0; }
        else if (series.type === 'model') { series.queue = shuffledAfter(series.pool, current?.id); series.pos = 0; }
        else { stopSeries(); ui.orderedNext.disabled = true; ui.speechStatus.textContent = '最後の格言まで再生しました。'; return; }
      }
      current = series.queue[series.pos++];
      if (series.type === 'random') rememberRandom(current);
    }
    series.currentItemId = current.id;
    series.currentReadCount = 1;
    renderItem(current);
    updateSeriesStatus();
    const activeSeries = series;
    speakCurrent(() => scheduleNext(activeSeries));
  }
  function stopSeries() {
    window.clearTimeout(seriesTimer);
    seriesTimer = null;
    stopSpeech();
    stopTopicSpeech();
    series = null;
    trioPlayback = null;
    stopRecordPlayback();
    ui.series.hidden = true;
    ui.speechStatus.textContent = '';
    updatePreviousButton();
    updateOrderedNextButton();
    updateRecordTrioButton();
  }
  function randomOne() { stopSeries(); const next = chooseRandom(mode === 'topic' ? topicItems() : items); if (next) { rememberRandom(current); rememberRandom(next); renderItem(next); } }
  function nextInSourceOrder() {
    if (series?.type === 'ordered' || series?.type === 'numbered') { advanceSeries(true); return; }
    const index = sourceOrderedItems.findIndex(item => item.id === current?.id);
    const next = sourceOrderedItems[index + 1];
    if (!next) return;
    stopSeries();
    rememberRandom(current);
    rememberRandom(next);
    renderItem(next);
  }
  function moveBy(direction, distance) {
    const { queue, index, inSeriesQueue } = stepNavigation();
    if (index < 0) return;
    const targetIndex = index + direction * distance;
    if (targetIndex < 0 || targetIndex >= queue.length) return;
    const target = queue[targetIndex];
    if (inSeriesQueue) {
      const activeSeries = series;
      window.clearTimeout(seriesTimer);
      seriesTimer = null;
      stopSpeech();
      current = target;
      activeSeries.pos = targetIndex + 1;
      activeSeries.currentItemId = current.id;
      activeSeries.currentReadCount = 1;
      renderItem(current);
      updateSeriesStatus();
      speakCurrent(() => scheduleNext(activeSeries));
      return;
    }
    stopSeries();
    rememberRandom(current);
    rememberRandom(target);
    renderItem(target);
  }
  function previousRandom() {
    if (recordPlaybackRun || trioPlayback) stopSeries();
    if (series?.type === 'model' || series?.type === 'ordered' || series?.type === 'numbered' || series?.type === 'topic') {
      if (series.pos <= 1) return;
      const activeSeries = series;
      window.clearTimeout(seriesTimer);
      seriesTimer = null;
      stopSpeech();
      series.pos--;
      current = series.queue[series.pos - 1];
      series.currentItemId = current.id;
      series.currentReadCount = 1;
      renderItem(current);
      updateSeriesStatus();
      speakCurrent(() => scheduleNext(activeSeries));
      return;
    }
    if (randomHistoryPos <= 0 || randomHistory[randomHistoryPos]?.id !== current?.id) return;
    const activeSeries = series?.type === 'random' ? series : null;
    if (activeSeries) { window.clearTimeout(seriesTimer); seriesTimer = null; stopSpeech(); }
    randomHistoryPos--;
    const previousItem = randomHistory[randomHistoryPos];
    if (activeSeries) { activeSeries.currentItemId = previousItem.id; activeSeries.currentReadCount = 1; }
    renderItem(previousItem);
    if (activeSeries) speakCurrent(() => scheduleNext(activeSeries));
    else speakCurrent();
  }
  function setMode(nextMode, selectedItem = null) {
    stopSeries(); stopTopicSpeech(); mode = nextMode;
    ui.tabs.forEach(tab => { const active = tab.dataset.mode === mode; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
    ui.picker.hidden = mode !== 'topic';
    ui.randomPicker.hidden = mode !== 'random';
    if (mode === 'random') { if (selectedItem) { rememberRandom(selectedItem); renderItem(selectedItem); } else randomOne(); ui.modeLabel.textContent = 'RANDOM PRACTICE'; }
    else { const list = topicItems(); const selected = chooseRandom(list); if (selected) { rememberRandom(selected); renderItem(selected); } updateTopicCount(); renderTopicSpeech(ui.topic.value); }
  }
  function updateTopicCount() {
    const count = topicItems().length;
    ui.topicCount.textContent = `${count}件の一文`;
    ui.topicPlay.disabled = count < 1;
  }

  function renderLibrary(query = '') {
    const terms = query.trim().toLocaleLowerCase('ja').split(/\s+/).filter(Boolean);
    const matched = sourceOrderedItems.filter(item => {
      const searchable = [item.id, String(item.id).padStart(3, '0'), item.topic, item.topicLabel, item.ja, item.en, item.sourceImage].join(' ').toLocaleLowerCase('ja');
      return terms.every(term => searchable.includes(term));
    });
    const fragment = document.createDocumentFragment();
    for (const item of matched) {
      const row = document.createElement('li');
      row.className = 'library-row';
      const button = document.createElement('button');
      button.className = 'library-entry';
      button.type = 'button';
      const meta = document.createElement('span');
      meta.className = 'library-entry-meta';
      const number = document.createElement('span');
      number.className = 'library-entry-number';
      number.textContent = `NO. ${String(item.id).padStart(3, '0')}`;
      const topic = document.createElement('span');
      topic.className = 'library-entry-topic';
      topic.textContent = item.topicLabel || item.topic || '';
      meta.append(number, topic);
      const japanese = document.createElement('span');
      japanese.className = 'library-entry-ja';
      japanese.textContent = item.ja || '';
      const english = document.createElement('span');
      english.className = 'library-entry-en';
      english.textContent = item.en || '';
      const source = document.createElement('span');
      source.className = 'library-entry-source';
      source.textContent = item.sourceImage ? `出典画像 ${item.sourceImage}` : '';
      button.append(meta, japanese, english, source);
      button.addEventListener('click', () => openLibraryItem(item));
      row.append(button);
      fragment.append(row);
    }
    ui.libraryList.replaceChildren(fragment);
    ui.libraryCount.textContent = `${sourceOrderedItems.length}件`;
    ui.libraryResultCount.textContent = terms.length ? `${matched.length} / ${sourceOrderedItems.length}件` : `${sourceOrderedItems.length}件`;
    ui.libraryEmpty.hidden = matched.length > 0;
  }

  function switchScreen(screen) {
    const showLibrary = screen === 'library';
    if (showLibrary) { stopSeries(); stopTopicSpeech(); }
    ui.practiceScreen.hidden = showLibrary;
    ui.libraryScreen.hidden = !showLibrary;
    ui.practiceScreenTab.classList.toggle('active', !showLibrary);
    ui.libraryScreenTab.classList.toggle('active', showLibrary);
    ui.practiceScreenTab.setAttribute('aria-selected', String(!showLibrary));
    ui.libraryScreenTab.setAttribute('aria-selected', String(showLibrary));
  }

  function openLibraryItem(item) {
    setMode('random', item);
    switchScreen('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('naigen-english-local', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('recordings', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }
  async function storeRecord(record) {
    const db = await openDb();
    await new Promise((resolve, reject) => { const request = db.transaction('recordings', 'readwrite').objectStore('recordings').put(record); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
  }
  async function deleteRecord(key) {
    const db = await openDb();
    await new Promise((resolve, reject) => { const request = db.transaction('recordings', 'readwrite').objectStore('recordings').delete(key); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
    await loadRecords();
  }
  function updateRecordControls() {
    ui.recordAll.disabled = allRecords.length === 0 || recordDeletionPending;
    ui.recordClear.disabled = allRecords.length === 0 || recordingStarting || recorder?.state === 'recording' || recordSavePending || recordDeletionPending;
    ui.recordCount.textContent = allRecords.length ? `(${allRecords.length})` : '';
    updateRecordTrioButton();
  }
  function currentRecordingRecords() {
    return current ? allRecords.filter(record => Number(record.id) === audioIdOf(current)).sort((a, b) => a.createdAt - b.createdAt) : [];
  }
  function updateRecordTrioButton() {
    if (!ui.recordTrio) return;
    const active = trioPlayback?.item.id === current?.id;
    ui.recordTrio.disabled = (!currentRecordingRecords().length && !active) || recordDeletionPending;
    ui.recordTrio.textContent = active ? '再生を停止' : 'モデル→自分→モデル';
  }
  async function loadRecords() {
    try {
      const db = await openDb();
      allRecords = await new Promise((resolve, reject) => { const request = db.transaction('recordings').objectStore('recordings').getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); });
    } catch { allRecords = []; }
    updateRecordControls();
    renderCurrentRecords();
  }
  function stopRecordPlayback() {
    recordPlaybackRun = null;
    if (playbackAudio) {
      playbackAudio.onended = null;
      playbackAudio.onerror = null;
      playbackAudio.onplay = null;
      playbackAudio.pause();
      playbackAudio.removeAttribute('src');
      playbackAudio.load();
      playbackAudio = null;
    }
    playbackQueue.forEach(url => URL.revokeObjectURL(url));
    playbackQueue = [];
  }
  async function deleteAllRecords() {
    if (recordDeletionPending) return;
    if (recordingStarting || recorder?.state === 'recording' || recordSavePending) {
      ui.recordStatus.textContent = '録音中または保存中のため、完了してから削除してください。';
      return;
    }
    const count = allRecords.length;
    if (!count || !window.confirm(`この端末に保存された自分の録音を${count}件、すべて削除しますか？この操作は元に戻せません。`)) return;
    recordDeletionPending = true;
    updateRecordControls();
    try {
      stopSeries();
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction('recordings', 'readwrite');
        transaction.objectStore('recordings').clear();
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Recording deletion failed'));
        transaction.onabort = () => reject(transaction.error || new Error('Recording deletion aborted'));
      });
      await loadRecords();
      ui.recordStatus.textContent = `自分の録音を${count}件削除しました。`;
    } catch {
      ui.recordStatus.textContent = '録音を削除できませんでした。';
    } finally {
      recordDeletionPending = false;
      updateRecordControls();
    }
  }
  function renderCurrentRecords() {
    recordObjectUrls.forEach(url => URL.revokeObjectURL(url));
    recordObjectUrls = [];
    ui.recordList.replaceChildren();
    const records = currentRecordingRecords();
    ui.recordStatus.textContent = records.length ? `この一文の録音 ${records.length}件 · この端末に保存` : 'この一文の録音はまだありません。';
    for (const record of records) {
      const row = document.createElement('div'); row.className = 'record-item';
      const time = document.createElement('span'); time.textContent = new Date(record.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = URL.createObjectURL(record.blob); recordObjectUrls.push(audio.src);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '削除'; remove.setAttribute('aria-label', '録音を削除'); remove.addEventListener('click', () => deleteRecord(record.key));
      row.append(time, audio, remove); ui.recordList.append(row);
    }
    updateRecordTrioButton();
  }
  async function toggleRecording() {
    if (recordDeletionPending) return;
    if (recorder?.state === 'recording') { recorder.stop(); return; }
    if (!current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { ui.recordStatus.textContent = 'この端末では録音に対応していません。'; return; }
    recordingStarting = true;
    updateRecordControls();
    try {
      const recordingQuoteId = current.id;
      const recordingId = audioIdOf(current);
      recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current || current.id !== recordingQuoteId) {
        recordStream.getTracks().forEach(track => track.stop()); recordStream = null;
        ui.recordStatus.textContent = '文が切り替わったため、録音を開始しませんでした。';
        return;
      }
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(recordStream, mime ? { mimeType: mime } : undefined);
      recordingParts = [];
      recorder.ondataavailable = event => { if (event.data.size) recordingParts.push(event.data); };
      recorder.onstop = async () => {
        recordSavePending = true;
        updateRecordControls();
        try {
          recordStream?.getTracks().forEach(track => track.stop()); recordStream = null;
          const blob = new Blob(recordingParts, { type: recorder.mimeType || 'audio/webm' });
          if (blob.size) {
            try { const createdAt = Date.now(); await storeRecord({ key: `${recordingId}-${createdAt}`, id: recordingId, blob, createdAt }); await loadRecords(); }
            catch { ui.recordStatus.textContent = '録音の保存に失敗しました。端末の空き容量をご確認ください。'; }
          }
          ui.record.textContent = '録音を開始';
        } finally {
          recordSavePending = false;
          updateRecordControls();
        }
      };
      recorder.start(); ui.record.textContent = '録音を停止'; ui.recordStatus.textContent = '録音中…';
    } catch { ui.recordStatus.textContent = 'マイクを使えません。ブラウザのマイク許可をご確認ください。'; }
    finally { recordingStarting = false; updateRecordControls(); }
  }
  function showRecordingItem(record) {
    const item = items.find(candidate => audioIdOf(candidate) === Number(record.id));
    if (!item) return;
    if (current?.id !== item.id) {
      rememberRandom(current);
      rememberRandom(item);
      renderItem(item);
    }
  }
  function finishRecordPlayback(run, message) {
    if (recordPlaybackRun !== run) return;
    if (playbackAudio) {
      playbackAudio.onended = null;
      playbackAudio.onerror = null;
      playbackAudio.onplay = null;
      playbackAudio = null;
    }
    playbackQueue.forEach(url => URL.revokeObjectURL(url));
    playbackQueue = [];
    recordPlaybackRun = null;
    ui.series.hidden = true;
    ui.speechStatus.textContent = message;
    updateRecordTrioButton();
  }
  function playRecordQueueItem(run) {
    if (recordPlaybackRun !== run) return;
    if (run.index >= run.records.length) {
      finishRecordPlayback(run, '録音の連続再生が終わりました。');
      return;
    }
    const audio = playbackAudio = new Audio(playbackQueue[run.index]);
    const record = run.records[run.index];
    const showStatus = () => {
      if (recordPlaybackRun !== run || playbackAudio !== audio) return;
      showRecordingItem(record);
      ui.series.hidden = false;
      ui.seriesStatus.textContent = `録音を連続再生 · ${run.index + 1} / ${run.records.length}`;
      ui.speechStatus.textContent = '自分の録音を再生中…';
    };
    const advance = () => {
      if (recordPlaybackRun !== run || playbackAudio !== audio) return;
      audio.onended = null;
      audio.onerror = null;
      audio.onplay = null;
      playbackAudio = null;
      run.index++;
      playRecordQueueItem(run);
    };
    audio.onplay = showStatus;
    audio.onended = advance;
    audio.onerror = advance;
    audio.play().catch(advance);
  }
  function playAllRecords() {
    if (recordPlaybackRun) {
      stopSeries();
      ui.speechStatus.textContent = '録音の連続再生を停止しました。';
      return;
    }
    const records = allRecords.slice().sort((a, b) => a.createdAt - b.createdAt);
    if (!records.length) return;
    stopSeries();
    playbackQueue = records.map(record => URL.createObjectURL(record.blob));
    recordPlaybackRun = { records, index: 0 };
    ui.series.hidden = false;
    ui.seriesStatus.textContent = `録音を連続再生 · 1 / ${records.length}`;
    playRecordQueueItem(recordPlaybackRun);
  }
  function finishTrioPlayback(run) {
    if (trioPlayback !== run) return;
    trioPlayback = null;
    ui.series.hidden = true;
    ui.speechStatus.textContent = 'モデル→自分→モデルの再生が終わりました。';
    updateRecordTrioButton();
  }
  function setTrioStage(run, stage, label) {
    if (trioPlayback !== run) return;
    run.stage = stage;
    ui.series.hidden = false;
    ui.seriesStatus.textContent = `モデル → 自分 → モデル · ${label}`;
  }
  function playTrioRecording(run) {
    if (trioPlayback !== run) return;
    setTrioStage(run, 'self', '2 / 3');
    const url = URL.createObjectURL(run.record.blob);
    playbackQueue = [url];
    const audio = playbackAudio = new Audio(url);
    audio.onended = () => {
      if (trioPlayback !== run || playbackAudio !== audio) return;
      audio.onended = null;
      audio.onerror = null;
      playbackAudio = null;
      URL.revokeObjectURL(url);
      playbackQueue = [];
      setTrioStage(run, 'model-after', '3 / 3');
      speakCurrent(() => finishTrioPlayback(run));
    };
    audio.onerror = () => {
      if (trioPlayback !== run || playbackAudio !== audio) return;
      stopSeries();
      ui.speechStatus.textContent = '自分の録音を再生できませんでした。';
    };
    audio.play().catch(() => {
      if (trioPlayback !== run || playbackAudio !== audio) return;
      stopSeries();
      ui.speechStatus.textContent = '自分の録音を再生できませんでした。';
    });
  }
  function playModelSelfModel() {
    if (!current) return;
    if (trioPlayback?.item.id === current.id) {
      stopSeries();
      ui.speechStatus.textContent = 'モデル→自分→モデルの再生を停止しました。';
      return;
    }
    const record = currentRecordingRecords().at(-1);
    if (!record) return;
    stopSeries();
    const run = { item: current, record, stage: 'model-before' };
    trioPlayback = run;
    updateRecordTrioButton();
    setTrioStage(run, 'model-before', '1 / 3');
    speakCurrent(() => playTrioRecording(run));
  }

  ui.tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  ui.practiceScreenTab.addEventListener('click', () => switchScreen('practice'));
  ui.libraryScreenTab.addEventListener('click', () => switchScreen('library'));
  ui.librarySearch.addEventListener('input', () => renderLibrary(ui.librarySearch.value));
  ui.randomPlay.addEventListener('click', () => startSeries('random', items));
  ui.orderedPlay.addEventListener('click', () => startSeries('ordered', sourceOrderedItems));
  ui.numberedPlay.forEach(button => button.addEventListener('click', () => startSeries('numbered', orderedItems.filter(item => Number(item.id) >= Number(button.dataset.startNumber)))));
  ui.topic.addEventListener('change', () => { stopSeries(); updateTopicCount(); renderTopicSpeech(ui.topic.value); if (mode === 'topic') { const selected = chooseRandom(topicItems()); if (selected) { rememberRandom(selected); renderItem(selected); } } });
  ui.topicSpeechGenerate.addEventListener('click', () => renderTopicSpeech(ui.topic.value));
  ui.topicSpeechPlay.addEventListener('click', playTopicSpeech);
  ui.topicPlay.addEventListener('click', () => startSeries('topic', topicItems()));
  ui.modelLoop.addEventListener('click', () => { if (current) startSeries('model', mode === 'topic' ? topicItems() : items); });
  try { ui.repeatTwice.checked = localStorage.getItem('naigen-repeat-maxims-twice') === 'true'; }
  catch { /* Repeat mode can still be selected for this session. */ }
  ui.repeatTwice.addEventListener('change', () => {
    try { localStorage.setItem('naigen-repeat-maxims-twice', String(ui.repeatTwice.checked)); }
    catch { /* Keep the selected mode for the current session. */ }
  });
  ui.speak.addEventListener('click', () => {
    if (recordPlaybackRun || trioPlayback) stopSeries();
    window.clearTimeout(seriesTimer);
    seriesTimer = null;
    const activeSeries = series;
    speakCurrent(activeSeries ? () => scheduleNext(activeSeries) : undefined);
  });
  try {
    const savedRate = Number(localStorage.getItem('naigen-model-playback-rate'));
    if (playbackRates.includes(savedRate)) modelPlaybackRate = savedRate;
  } catch { /* Playback speed can still be changed for this session. */ }
  ui.modelSpeed.value = String(modelPlaybackRate);
  ui.modelSpeed.addEventListener('change', () => {
    const selectedRate = Number(ui.modelSpeed.value);
    if (!playbackRates.includes(selectedRate)) return;
    modelPlaybackRate = selectedRate;
    try { localStorage.setItem('naigen-model-playback-rate', String(selectedRate)); }
    catch { /* Keep the selected speed for the current session. */ }
    if (quoteAudio) quoteAudio.playbackRate = selectedRate;
  });
  ui.pause.addEventListener('click', () => {
    if (!quoteAudio || !quotePlaybackActive) return;
    if (quoteAudio.paused) {
      quoteAudio.play().catch(() => {
        quotePlaybackActive = false;
        updatePauseButton();
        ui.speechStatus.textContent = 'Gemini音声を再生できませんでした。通信状態をご確認ください。';
      });
      ui.speechStatus.textContent = 'Gemini音声を再生中…';
    } else {
      quoteAudio.pause();
      ui.speechStatus.textContent = 'Gemini音声を一時停止中。';
    }
    updatePauseButton();
  });
  ui.previous.addEventListener('click', previousRandom);
  ui.previousTen.addEventListener('click', () => moveBy(-1, 10));
  ui.previousFifty.addEventListener('click', () => moveBy(-1, 50));
  ui.next.addEventListener('click', () => series ? advanceSeries(true) : randomOne());
  ui.orderedNext.addEventListener('click', nextInSourceOrder);
  ui.nextTen.addEventListener('click', () => moveBy(1, 10));
  ui.nextFifty.addEventListener('click', () => moveBy(1, 50));
  ui.stop.addEventListener('click', stopSeries);
  ui.record.addEventListener('click', toggleRecording);
  ui.recordAll.addEventListener('click', playAllRecords);
  ui.recordTrio.addEventListener('click', playModelSelfModel);
  ui.recordClear.addEventListener('click', deleteAllRecords);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; ui.install.hidden = false; });
  ui.install.addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; ui.install.hidden = true; });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js?v=88').catch(() => {});

  ui.total.textContent = `${items.length}件`;
  renderLibrary();
  const counts = new Map();
  for (const item of items) counts.set(item.topic, (counts.get(item.topic) || 0) + 1);
  [...counts.keys()].sort((a, b) => a.localeCompare(b, 'ja')).forEach(topic => {
    const option = document.createElement('option'); option.value = topic; option.textContent = `${topic} · ${counts.get(topic)}`; ui.topic.append(option);
  });
  Object.keys(topicSpeechSets).forEach(topic => {
    const button = document.createElement('button');
    button.className = 'button button-outline topic-speech-topic';
    button.type = 'button';
    button.dataset.speechTopic = topic;
    button.textContent = topic;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      ui.topic.value = topic;
      ui.topic.dispatchEvent(new Event('change', { bubbles: true }));
    });
    ui.topicSpeechButtons.append(button);
  });
  if (topicSpeechSets[ui.topic.value]) renderTopicSpeech(ui.topic.value);
  updateTopicCount();
  updatePauseButton();
  const first = chooseRandom();
  rememberRandom(first);
  renderItem(first);
  loadRecords();
})();
