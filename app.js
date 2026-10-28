(() => {
  'use strict';
  const items = window.MAXIMS || [];
  const orderedItems = [...items].sort((a, b) => Number(a.id) - Number(b.id));
  const $ = (id) => document.getElementById(id);
  const ui = {
    practiceScreen: $('practice-screen'), libraryScreen: $('library-screen'), practiceScreenTab: $('practice-screen-tab'), libraryScreenTab: $('library-screen-tab'), libraryCount: $('library-count'), libraryResultCount: $('library-result-count'), librarySearch: $('library-search'), libraryList: $('library-list'), libraryEmpty: $('library-empty'),
    total: $('total-count'), tabs: [...document.querySelectorAll('.mode-tab')], randomPicker: $('random-picker'), randomPlay: $('random-play'), picker: $('topic-picker'), topic: $('topic-select'), topicPlay: $('topic-play'), topicCount: $('topic-count'),
    modeLabel: $('mode-label'), number: $('item-number'), topicLabel: $('item-topic'), source: $('source-page'), en: $('english-quote'), enJa: $('english-japanese'), speak: $('speak-button'), pause: $('pause-button'), modelSpeed: $('model-speed'), repeatTwice: $('repeat-twice'), modelLoop: $('model-loop-button'), speechStatus: $('speech-status'), previous: $('previous-button'), next: $('next-button'),
    series: $('series-bar'), seriesStatus: $('series-status'), stop: $('series-stop'), record: $('record-button'), recordStatus: $('record-status'), recordList: $('record-list'), recordAll: $('record-play-all'), recordCount: $('record-count'), install: $('install-button')
  };
  let mode = 'random', current = null, series = null, seriesTimer = null, quoteAudio = null, quotePlaybackActive = false, speechVersion = 0, recorder = null, recordingParts = [], recordStream = null, allRecords = [], playbackQueue = [], playbackAudio = null, recordObjectUrls = [], installPrompt = null;
  let randomHistory = [], randomHistoryPos = -1;
  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let modelPlaybackRate = 1;
  let dbPromise;
  const functionWords = new Set(`a an the i me my you your yourself we our ourselves they them their themselves he him his she her it its this that these those who whom whose which what when where why how another each every either neither all no any some as at by for from in into of on onto out over under with within without after before against between beyond through to than like and or but so because if while although though unless until whether then instead rather not do does did can cannot could may might must shall should will would am is are was were be been being has had ought`.split(' '));

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
    ui.previous.disabled = series?.type === 'model'
      ? series.pos <= 1
      : mode !== 'random' || randomHistoryPos <= 0;
  }
  function updateSeriesStatus() {
    if (!series) return;
    const repeatLabel = series.repeatCount === 2 ? '（各格言を2回）' : '';
    const position = `${series.pos} / ${series.queue.length}`;
    ui.seriesStatus.textContent = series.type === 'model'
      ? `モデル音声を連続再生中${repeatLabel} · ${position}`
      : `${series.type === 'random' ? 'ランダム' : 'トピック'}連続再生${repeatLabel} · ${position}`;
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
    ui.source.textContent = `出典画像 ${item.sourceImage} / 602（ZIP内のファイル名順）`;
    renderEnglish(item.en);
    ui.enJa.textContent = item.ja;
    ui.modeLabel.textContent = mode === 'topic' ? 'TOPIC PRACTICE' : 'RANDOM PRACTICE';
    renderCurrentRecords();
    updatePreviousButton();
  }
  function updatePauseButton() {
    const canToggle = quotePlaybackActive && quoteAudio && !quoteAudio.ended;
    ui.pause.disabled = !canToggle;
    ui.pause.textContent = canToggle && quoteAudio.paused ? '再開' : '一時停止';
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
  function speakCurrent(onEnd) {
    if (!current) return;
    stopSpeech();
    const version = speechVersion;
    const audio = quoteAudio ||= new Audio();
    audio.src = `./audio/q${String(current.id).padStart(3, '0')}.mp3`;
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
      if (series) stopSeries();
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
        else { stopSeries(); return; }
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
    series = null;
    ui.series.hidden = true;
    ui.speechStatus.textContent = '';
    updatePreviousButton();
  }
  function randomOne() { stopSeries(); const next = chooseRandom(mode === 'topic' ? topicItems() : items); if (next) { if (mode === 'random') rememberRandom(next); renderItem(next); } }
  function previousRandom() {
    if (series?.type === 'model') {
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
    if (mode !== 'random' || randomHistoryPos <= 0) return;
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
    stopSeries(); mode = nextMode;
    ui.tabs.forEach(tab => { const active = tab.dataset.mode === mode; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
    ui.picker.hidden = mode !== 'topic';
    ui.randomPicker.hidden = mode !== 'random';
    if (mode === 'random') { if (selectedItem) { rememberRandom(selectedItem); renderItem(selectedItem); } else randomOne(); ui.modeLabel.textContent = 'RANDOM PRACTICE'; }
    else { const list = topicItems(); renderItem(chooseRandom(list)); updateTopicCount(); }
  }
  function updateTopicCount() {
    const count = topicItems().length;
    ui.topicCount.textContent = `${count}件の一文`;
    ui.topicPlay.disabled = count < 1;
  }

  function renderLibrary(query = '') {
    const terms = query.trim().toLocaleLowerCase('ja').split(/\s+/).filter(Boolean);
    const matched = orderedItems.filter(item => {
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
    ui.libraryCount.textContent = `${orderedItems.length}件`;
    ui.libraryResultCount.textContent = terms.length ? `${matched.length} / ${orderedItems.length}件` : `${orderedItems.length}件`;
    ui.libraryEmpty.hidden = matched.length > 0;
  }

  function switchScreen(screen) {
    const showLibrary = screen === 'library';
    if (showLibrary) stopSeries();
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
  async function loadRecords() {
    try {
      const db = await openDb();
      allRecords = await new Promise((resolve, reject) => { const request = db.transaction('recordings').objectStore('recordings').getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); });
    } catch { allRecords = []; }
    ui.recordAll.disabled = allRecords.length === 0;
    ui.recordCount.textContent = allRecords.length ? `(${allRecords.length})` : '';
    renderCurrentRecords();
  }
  function renderCurrentRecords() {
    recordObjectUrls.forEach(url => URL.revokeObjectURL(url));
    recordObjectUrls = [];
    ui.recordList.replaceChildren();
    const records = current ? allRecords.filter(record => record.id === current.id).sort((a, b) => a.createdAt - b.createdAt) : [];
    ui.recordStatus.textContent = records.length ? `この一文の録音 ${records.length}件 · この端末に保存` : 'この一文の録音はまだありません。';
    for (const record of records) {
      const row = document.createElement('div'); row.className = 'record-item';
      const time = document.createElement('span'); time.textContent = new Date(record.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = URL.createObjectURL(record.blob); recordObjectUrls.push(audio.src);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '削除'; remove.setAttribute('aria-label', '録音を削除'); remove.addEventListener('click', () => deleteRecord(record.key));
      row.append(time, audio, remove); ui.recordList.append(row);
    }
  }
  async function toggleRecording() {
    if (recorder?.state === 'recording') { recorder.stop(); return; }
    if (!current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { ui.recordStatus.textContent = 'この端末では録音に対応していません。'; return; }
    try {
      const recordingId = current.id;
      recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current || current.id !== recordingId) {
        recordStream.getTracks().forEach(track => track.stop()); recordStream = null;
        ui.recordStatus.textContent = '文が切り替わったため、録音を開始しませんでした。';
        return;
      }
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(recordStream, mime ? { mimeType: mime } : undefined);
      recordingParts = [];
      recorder.ondataavailable = event => { if (event.data.size) recordingParts.push(event.data); };
      recorder.onstop = async () => {
        recordStream?.getTracks().forEach(track => track.stop()); recordStream = null;
        const blob = new Blob(recordingParts, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size) {
          try { const createdAt = Date.now(); await storeRecord({ key: `${recordingId}-${createdAt}`, id: recordingId, blob, createdAt }); await loadRecords(); }
          catch { ui.recordStatus.textContent = '録音の保存に失敗しました。端末の空き容量をご確認ください。'; }
        }
        ui.record.textContent = '録音を開始';
      };
      recorder.start(); ui.record.textContent = '録音を停止'; ui.recordStatus.textContent = '録音中…';
    } catch { ui.recordStatus.textContent = 'マイクを使えません。ブラウザのマイク許可をご確認ください。'; }
  }
  async function playAllRecords() {
    playbackAudio?.pause();
    playbackQueue.forEach(url => URL.revokeObjectURL(url));
    playbackQueue = allRecords.slice().sort((a, b) => a.createdAt - b.createdAt).map(record => URL.createObjectURL(record.blob));
    if (!playbackQueue.length) return;
    let index = 0;
    const finish = () => { playbackQueue.forEach(url => URL.revokeObjectURL(url)); playbackQueue = []; playbackAudio = null; };
    const audio = playbackAudio = new Audio();
    audio.onended = () => { if (++index < playbackQueue.length) { audio.src = playbackQueue[index]; audio.play().catch(() => { finish(); }); } else { finish(); ui.recordStatus.textContent = '録音の連続再生が終わりました。'; } };
    audio.onerror = () => { if (++index < playbackQueue.length) { audio.src = playbackQueue[index]; audio.play().catch(finish); } else finish(); };
    audio.src = playbackQueue[index]; ui.recordStatus.textContent = '録音を連続再生中…'; audio.play().catch(() => { finish(); ui.recordStatus.textContent = '録音を再生できませんでした。'; });
  }

  ui.tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  ui.practiceScreenTab.addEventListener('click', () => switchScreen('practice'));
  ui.libraryScreenTab.addEventListener('click', () => switchScreen('library'));
  ui.librarySearch.addEventListener('input', () => renderLibrary(ui.librarySearch.value));
  ui.randomPlay.addEventListener('click', () => startSeries('random', items));
  ui.topic.addEventListener('change', () => { stopSeries(); updateTopicCount(); if (mode === 'topic') renderItem(chooseRandom(topicItems())); });
  ui.topicPlay.addEventListener('click', () => startSeries('topic', topicItems()));
  ui.modelLoop.addEventListener('click', () => { if (current) startSeries('model', mode === 'topic' ? topicItems() : items); });
  try { ui.repeatTwice.checked = localStorage.getItem('naigen-repeat-maxims-twice') === 'true'; }
  catch { /* Repeat mode can still be selected for this session. */ }
  ui.repeatTwice.addEventListener('change', () => {
    try { localStorage.setItem('naigen-repeat-maxims-twice', String(ui.repeatTwice.checked)); }
    catch { /* Keep the selected mode for the current session. */ }
  });
  ui.speak.addEventListener('click', () => {
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
  ui.next.addEventListener('click', () => series ? advanceSeries(true) : randomOne());
  ui.stop.addEventListener('click', stopSeries);
  ui.record.addEventListener('click', toggleRecording);
  ui.recordAll.addEventListener('click', playAllRecords);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; ui.install.hidden = false; });
  ui.install.addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; ui.install.hidden = true; });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js?v=34').catch(() => {});

  ui.total.textContent = `${items.length}件`;
  renderLibrary();
  const counts = new Map();
  for (const item of items) counts.set(item.topic, (counts.get(item.topic) || 0) + 1);
  [...counts.keys()].sort((a, b) => a.localeCompare(b, 'ja')).forEach(topic => {
    const option = document.createElement('option'); option.value = topic; option.textContent = `${topic} · ${counts.get(topic)}`; ui.topic.append(option);
  });
  updateTopicCount();
  updatePauseButton();
  const first = chooseRandom();
  rememberRandom(first);
  renderItem(first);
  loadRecords();
})();
