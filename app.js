(() => {
  'use strict';
  const items = window.MAXIMS || [];
  const $ = (id) => document.getElementById(id);
  const ui = {
    total: $('total-count'), heroCount: $('hero-count'), tabs: [...document.querySelectorAll('.mode-tab')], randomPicker: $('random-picker'), randomPlay: $('random-play'), picker: $('topic-picker'), topic: $('topic-select'), topicPlay: $('topic-play'), topicCount: $('topic-count'),
    modeLabel: $('mode-label'), number: $('item-number'), topicLabel: $('item-topic'), ja: $('japanese-quote'), enWrap: $('english-wrap'), en: $('english-quote'), reveal: $('reveal-button'), speak: $('speak-button'), next: $('next-button'),
    series: $('series-bar'), seriesStatus: $('series-status'), stop: $('series-stop'), record: $('record-button'), recordStatus: $('record-status'), recordList: $('record-list'), recordAll: $('record-play-all'), recordCount: $('record-count'), install: $('install-button')
  };
  let mode = 'random', current = null, series = null, recorder = null, recordingParts = [], recordStream = null, allRecords = [], playbackQueue = [], playbackAudio = null, recordObjectUrls = [], installPrompt = null;
  let dbPromise;

  function shuffled(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function topicItems() { return items.filter(item => item.topic === ui.topic.value); }
  function renderItem(item) {
    if (!item) return;
    current = item;
    ui.number.textContent = `NO. ${String(item.id).padStart(3, '0')}`;
    ui.topicLabel.textContent = item.topicLabel || item.topic;
    ui.ja.textContent = item.ja;
    ui.en.textContent = item.en;
    ui.enWrap.hidden = true;
    ui.reveal.textContent = '英語を見る';
    ui.modeLabel.textContent = mode === 'topic' ? 'TOPIC PRACTICE' : 'RANDOM PRACTICE';
    renderCurrentRecords();
  }
  function reveal() {
    const showing = !ui.enWrap.hidden;
    ui.enWrap.hidden = showing;
    ui.reveal.textContent = showing ? '英語を見る' : '英語を隠す';
  }
  function stopSpeech() { window.speechSynthesis?.cancel(); }
  function speakCurrent(onEnd) {
    if (!current || !('speechSynthesis' in window)) { ui.recordStatus.textContent = 'このブラウザでは音声読み上げに対応していません。'; return; }
    revealIfHidden();
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(current.en);
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(v => /^en-US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
    utterance.lang = utterance.voice?.lang || 'en-US';
    utterance.rate = 0.88;
    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = () => { if (series) stopSeries(); ui.recordStatus.textContent = '読み上げを開始できませんでした。'; };
    speechSynthesis.speak(utterance);
  }
  function revealIfHidden() { if (ui.enWrap.hidden) reveal(); }
  function chooseRandom(list = items) { if (!list.length) return null; return list[Math.floor(Math.random() * list.length)]; }
  function startSeries(type, list) {
    if (list.length < 2) { ui.recordStatus.textContent = 'このモードには2件以上の格言が必要です。'; return; }
    stopSpeech();
    series = { type, queue: type === 'random' ? shuffled(list) : [...list], pos: 0 };
    ui.series.hidden = false;
    advanceSeries();
  }
  function advanceSeries() {
    if (!series) return;
    if (series.pos >= series.queue.length) {
      if (series.type === 'random') { series.queue = shuffled(items); series.pos = 0; }
      else { stopSeries(); return; }
    }
    current = series.queue[series.pos++];
    renderItem(current);
    ui.seriesStatus.textContent = `${series.type === 'random' ? 'ランダム' : 'トピック'}連続再生 · ${series.pos} / ${series.queue.length}`;
    speakCurrent(() => window.setTimeout(advanceSeries, 550));
  }
  function stopSeries() { stopSpeech(); series = null; ui.series.hidden = true; }
  function randomOne() { stopSeries(); const next = chooseRandom(mode === 'topic' ? topicItems() : items); if (next) renderItem(next); }
  function setMode(nextMode) {
    stopSeries(); mode = nextMode;
    ui.tabs.forEach(tab => { const active = tab.dataset.mode === mode; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
    ui.picker.hidden = mode !== 'topic';
    ui.randomPicker.hidden = mode !== 'random';
    if (mode === 'random') { randomOne(); ui.modeLabel.textContent = 'RANDOM PRACTICE'; }
    else { const list = topicItems(); renderItem(chooseRandom(list)); updateTopicCount(); }
  }
  function updateTopicCount() {
    const count = topicItems().length;
    ui.topicCount.textContent = `${count}件の格言`;
    ui.topicPlay.disabled = count < 2;
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
  ui.randomPlay.addEventListener('click', () => startSeries('random', items));
  ui.topic.addEventListener('change', () => { stopSeries(); updateTopicCount(); if (mode === 'topic') renderItem(chooseRandom(topicItems())); });
  ui.topicPlay.addEventListener('click', () => startSeries('topic', topicItems()));
  ui.reveal.addEventListener('click', reveal);
  ui.speak.addEventListener('click', () => speakCurrent());
  ui.next.addEventListener('click', () => series ? advanceSeries() : randomOne());
  ui.stop.addEventListener('click', stopSeries);
  ui.record.addEventListener('click', toggleRecording);
  ui.recordAll.addEventListener('click', playAllRecords);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; ui.install.hidden = false; });
  ui.install.addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; ui.install.hidden = true; });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});

  ui.total.textContent = `${items.length}件`;
  ui.heroCount.textContent = `${items.length} MAXIMS`;
  const counts = new Map();
  for (const item of items) counts.set(item.topic, (counts.get(item.topic) || 0) + 1);
  [...counts.keys()].sort((a, b) => a.localeCompare(b, 'ja')).forEach(topic => {
    const option = document.createElement('option'); option.value = topic; option.textContent = `${topic} · ${counts.get(topic)}`; ui.topic.append(option);
  });
  updateTopicCount();
  renderItem(chooseRandom());
  loadRecords();
})();
