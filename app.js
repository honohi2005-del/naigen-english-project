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
  // Each entry is a complete, independently written B2-level speech inspired by this topic's maxims.
  const topicSpeechSets = {
    '意味と思索': [
      `I used to believe that understanding meant finding the correct label. Yet a walk through my neighborhood changed my mind: familiar streets felt different after a difficult conversation. Meaning had not arrived as a definition; it had grown through contact between memory, place, and another person. Since then, I leave some experiences unnamed for a while. Their significance may become clearer as life continues.`,
      `A story is not a box that keeps every event in its proper place. It is more like a path that can bend when something unexpected appears. Looking back, I sometimes discover that a mistake or loss belongs to a larger story than I first imagined. The event itself has not changed, but its place in my life has. That possibility makes uncertainty easier to face.`,
      `Where does a choice come from: a private self, a family, or the world around us? I cannot draw a clean line between them. A room, a conversation, even the tools within reach can shape what seems possible. Then our actions alter those surroundings for someone else. Perhaps identity is less like a hidden object and more like a relationship continually taking shape.`,
      `When a friend asks what an experience meant, I try not to answer too quickly. The first explanation is often neat, but neatness can erase the detail that mattered. I describe what I noticed, including what still confuses me. Listening to my own account, I may find a new connection. Words do not simply report a finished meaning; they sometimes help one emerge.`,
      `We often want to decide whether an experience was good or bad before we have understood it. I am learning to wait. An awkward meeting may later become the beginning of a friendship; a plan that failed may expose a desire I had ignored. This does not make every painful event secretly useful. It means a single moment cannot always tell the whole truth about itself.`,
      `A map can guide me across a city, but it cannot tell me how the rain smells or why one street feels welcoming. Knowing the world requires more than collecting descriptions from a distance. I have to walk, touch, listen, and let the place answer through my body. What I learn then is neither purely inside me nor simply outside. It grows between us.`,
      `Sometimes I cannot explain why a particular sentence stays with me. Months later, I may notice that it changed how I listen to a colleague or treat myself after a mistake. The wording may fade, while its effect remains in my choices. Meaning is not always a message we store intact. It can be a quiet change in the way we meet the next day.`,
      `In dim light, a familiar room becomes strange again. Shadows hide some edges and invite the imagination to fill them in. I used to think clear vision meant seeing everything sharply, but uncertainty can also make attention more active. We remember, guess, and revise what we think is there. Perhaps not every gap needs to be closed before experience becomes real.`,
      `I cannot choose every event that enters my life, and I cannot control what others will make of it. Still, I can decide whether to meet a responsibility honestly. That decision asks me to understand something about who I am, while leaving open the possibility that I may refuse. Freedom feels less like total control and more like accepting the weight of a choice.`,
      `A conversation rarely follows the route I planned. Someone pauses, changes the subject, or tells a story that shifts the room. If I insist on my prepared meaning, I may miss what is being created between us. Letting the exchange surprise me is not the same as having no direction. It gives both people room to shape a thought that neither could have made alone.`
    ],
    '学びと思考': [
      `My first attempt at a new skill is usually clumsy, which is useful information. I can notice where the movement breaks down, ask for one clear piece of feedback, and try again. Repeating the same action without attention changes little. The real lesson begins when I compare what I expected with what happened. A mistake becomes valuable only when it helps me make a different next attempt.`,
      `Education can feel like a journey without a final station. A lesson may give me a map, yet the landscape changes when I travel with someone whose experience differs from mine. I learn to see familiar questions from another direction. Arriving at an answer matters, but so does becoming more alert to what I had overlooked. A new viewpoint can keep teaching long after class ends.`,
      `Reading instructions did not teach me how to knead dough. Watching my aunt's hands did: she pressed, turned, and waited until the texture felt right. Then I tried, received advice, and tried again. Words helped me name a few details, but they could not replace seeing and feeling the work. Some kinds of knowledge arrive through careful imitation before we can explain what we know.`,
      `A notebook can support independent study, but its design matters. If every page asks only for a correct answer, I may stop asking my own questions. A useful tool invites me to compare, experiment, and return to an unfinished idea. The object does not teach by itself; it changes what I can do without waiting for permission. Good tools widen the space for self-directed learning.`,
      `When a movement looks simple, copying its outline may still produce a weak result. The important support can be hidden in balance, timing, or the way force travels through the body. I improve when I ask what structure makes the visible action possible. This habit also helps with language and music: careful attention to relationships reveals more than memorizing separate pieces.`,
      `A class occupies only a small part of a learner's week. Most learning happens later, when a question returns during ordinary life and finds a place to grow. That is why a memorable example can matter more than covering many pages. It changes how I notice the world after class. Teaching well may mean planting a useful way of seeing, then trusting the learner to explore it.`,
      `In a workshop, I learned as much from watching the instructor repair a mistake as from watching a perfect demonstration. The repair showed patience, judgment, and a way to begin again. A teacher is not only a source of answers; a person can model how to remain curious under pressure. Seeing someone think in real time gives students a living example they can question and adapt.`,
      `At first, every step of playing a simple song demanded my full attention. After months of practice, my fingers could find the notes while I listened for phrasing. That change did not end learning; it moved my attention toward a richer challenge. When a skill becomes familiar in the body, awareness is free to notice details that were previously beyond reach.`,
      `A score tells me whether my answer matches a key, but it says little about what I understand. I learn more by studying why an error happened and what evidence could change my mind. This takes longer than counting right answers, yet it gives the result a future. The point of assessment is not a label attached to me; it is a better question for my next study session.`,
      `Trying a view that feels unfamiliar can be uncomfortable, especially when my old explanation has served me well. I do not have to accept every new idea. I can test it against experience, listen to people who see differently, and notice what changes. Intellectual courage is not certainty in a new belief. It is the willingness to let evidence make my thinking less comfortable and more precise.`
    ],
    '行動と内省': [
      `My hands often begin a familiar task before I have noticed what the situation requires. In practice, I pause long enough to see the other person's movement, then let my response begin. This small delay can free me from the habit of repeating yesterday's answer. The aim is not to control every muscle. It is to give attention a chance to meet the present moment first.`,
      `Before an important conversation, I breathe out slowly and feel my feet on the floor. I am not trying to become perfectly calm; I am making room to hear the other person. When my shoulders soften, my response is less hurried. A quiet body can still act decisively. Sometimes preparation is simply removing the extra effort that prevents a natural movement from appearing.`,
      `A plan can reduce uncertainty, but it cannot guarantee the result. I have started to treat trust as a willingness to act without controlling every consequence. That includes knowing what risk I can accept and what boundary I need to keep. If disappointment comes, it will matter, but it will not prove that choosing trust was foolish. Courage includes making space for outcomes I cannot command.`,
      `In a fast exchange, I used to watch only the hand coming toward me. Now I try to notice the whole pattern: weight, direction, hesitation, and the space between us. My response becomes clearer when I read what may happen without pretending I can predict everything. Observation is not passive waiting. It prepares a timely action while leaving my body free to change course.`,
      `The more I tell myself to move correctly, the more stiffly I sometimes move. A teacher once asked me to notice the floor instead of monitoring each joint. My balance improved before I could explain why. Attention can guide action, but too much instruction can interfere with the body's own coordination. I am learning to observe carefully, then allow a practiced movement to unfold.`,
      `After making a mistake, I can spend an entire evening replaying it and calling that reflection. Yet the replay rarely teaches me anything new. A kinder review asks what happened, what I can repair, and what I will try next time. Then I let the moment end. Responsibility does not require endless punishment; it requires enough honesty to choose a better next action.`,
      `There are days when an empty hour feels like a problem I must solve. Lately, I have tried letting it remain empty. Without rushing to fill the space, I notice fatigue, curiosity, or a wish to take a walk. Rest is not always avoidance. Sometimes doing less loosens the pressure that keeps me from sensing what would be worth doing next.`,
      `When I return to an activity after a long break, my old habits arrive before my confidence does. If I rush to prove that I still know what to do, my movements become busy and tense. Beginning slowly lets me notice what my body remembers and what it has forgotten. A fresh start is not a failure of discipline; it is a chance to respond to today's ability.`,
      `A person across the room looked impatient, and I immediately began speaking faster. Then I noticed that I had mistaken a glance for a demand. I took a breath and continued at a pace that felt clear. Other people's reactions matter, but they do not have to dictate every movement. Paying attention gives me choices; reacting automatically narrows them before I understand the situation.`,
      `Improvement does not always come from pushing harder. On a good day, I notice a small adjustment without searching for it, as if the next move has appeared by itself. I cannot force that ease, but I can create conditions for it: steady practice, enough rest, and patient observation. The body often finds a useful answer when the mind stops interrupting every step.`
    ],
    '発音と身体': [
      `Before I speak, I let my breath leave without squeezing out the last trace of air. A light inhale follows, and my throat feels less crowded. This simple rhythm helps me begin without forcing the first word. I still need to choose what to say, but the voice no longer has to fight my body for space. Clear speech can start with a quiet physical adjustment.`,
      `A phrase is not a row of separate sounds. Its rhythm carries the listener from one idea to the next, while pauses give important words room to land. When I read aloud, I listen for where the sentence wants to breathe. The timing often improves before my pronunciation does. Speaking well is partly a matter of shaping time so another person can follow.`,
      `I once raised my voice whenever I wanted to sound confident. People heard me, but the conversation felt like a contest. Now I try to speak with enough energy to be clear and enough space for an answer. A voice can invite someone into a shared rhythm instead of pushing them toward agreement. Strength does not always need extra volume; sometimes it sounds like ease.`,
      `A recording can copy the pitch of a human voice, yet I still listen for the body behind the sound. Breath changes, a consonant takes effort, and a phrase carries traces of a particular person. These details make speech more than accurate sound. When I listen closely, I hear a physical presence meeting another one. That attention changes how carefully I choose my own words.`,
      `When a sound feels wrong, I used to correct it by tightening my mouth. Now I notice the path of the breath, the movement of my tongue, and the shape of the phrase. A small change in one place can affect the whole word. Pronunciation is not a performance of isolated parts; it is coordinated movement. My body needs practice as much as my ear needs examples.`,
      `My voice did not become steadier after one perfect lesson. It grew through ordinary conversations, awkward recordings, and the choice to try again. Each experience taught me something different about pace, breath, or attention. Practice is not merely repeating a sound until it is correct. It is learning how a voice can stay responsive when the people and circumstances keep changing.`,
      `Sometimes a sentence sounds polished but reaches no one. I have learned to notice whether the listener has time to receive it. A pause, a softer ending, or a change of pace can carry more care than another explanation. Meaning travels through the body as well as through vocabulary. My voice works best when I listen to the room while I speak.`,
      `A strong voice is not necessarily a loud one. When my posture is settled and my breath moves freely, even a quiet sentence can carry. If I brace my neck, I hear effort where I wanted to express certainty. So I practice finding support lower in my body and letting the sound travel. The result feels less manufactured and easier for others to hear.`,
      `In music, a note changes when its length changes, even if its pitch stays the same. Speech works similarly: a brief pause can make a familiar phrase sound thoughtful or impatient. I try to feel the rhythm before I focus on each word. That does not mean ignoring pronunciation. It means allowing clear sounds to belong to a living pattern rather than a mechanical list.`,
      `Listening to a conversation, I can often sense tension before I know its cause. My own throat may tighten in response. If I notice that reaction, I can soften my breath instead of copying the other person's strain. This does not solve the disagreement, but it changes the sound I bring into it. A relaxed voice can make room for a more human exchange.`
    ],
    '表現と学習': [
      `Improvisation is not a promise that anything can happen. A performer has limited time, limited gestures, and an audience that remembers what came before. The challenge is to notice what the room expects, then choose a response that keeps the scene alive. Surprise matters because someone is there to receive it. Without attention to the audience, spontaneity can become only private display.`,
      `I learned a dance by copying the teacher's steps, but the copy was only a beginning. After I understood the rhythm, I could alter a turn to fit my balance and still remain in the music. A style does not appear by rejecting every model. It grows when practice becomes secure enough for personal choices, and those choices begin to feel unmistakably one's own.`,
      `Learning a language is like joining a game already in progress. The group has ways of taking turns, teasing, disagreeing, and showing interest. A dictionary can explain words, but participation teaches when a phrase feels right and what response it invites. I understand more when I enter the exchange and pay attention to others. Meaning is made through the play, not carried by words alone.`,
      `The first time a performer surprises an audience, the moment may feel electric. If the same trick returns every night, people begin to expect it. That does not mean surprise is useless; it means expression must keep listening. An audience brings its memory into the room. The performer can work with that memory, changing pace or direction so a familiar form opens a new possibility.`,
      `A tiny hesitation can make a character seem more truthful than a dramatic speech. It suggests that a thought is happening now, in front of us. Good performance often depends on such precise details: where the eyes rest, when the breath changes, how one gesture ends. Accuracy does not make expression cold. It gives the audience something concrete enough to imagine and feel.`,
      `When I teach a new movement, explaining every part can make students watch for instructions instead of watching the action. A clear demonstration gives them a whole pattern to explore. They can imitate, ask questions, and adjust it through practice. Words still help, especially when someone is stuck. But expression begins to feel alive when learners discover how a form works in their own bodies.`,
      `A conversation becomes dull when each person waits only for a chance to display a clever thought. I prefer the moments when a reply changes what I was about to say. We build a line of meaning together, sometimes through words and sometimes through a shared pause. Listening is not an interval between performances. It is part of the creative work itself.`,
      `Rules can look like walls until we discover what they make possible. A short scene, a repeated rhythm, or a limited set of words can focus attention on small changes. Within that frame, one unexpected choice may matter more. I enjoy the moment when a constraint stops feeling like a command and becomes material. Freedom in art can grow from working closely with limits.`,
      `I can imitate a skilled speaker's accent and still sound unlike myself. Over time, my own way of speaking develops from the phrases I choose, the pauses I need, and the experiences I bring. Learning the rules gives me options; it does not require a perfect copy. A personal style is not a shortcut around practice. It is one result of practice becoming part of me.`,
      `A performance reaches beyond the performer when the audience begins to imagine what is not shown. A glance toward an empty chair may suggest a person who never appears. I cannot dictate exactly what viewers will picture, and that openness is part of the art. Careful choices give their imagination a starting point, then leave enough room for it to travel in its own direction.`
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
    const library = topicSpeechSets[topic];
    if (!library) return '';
    let deck = topicSpeechHistory.get(topic);
    if (!deck || deck.remaining.length === 0) {
      const remaining = shuffled(library);
      if (deck?.last && remaining.length > 1 && remaining[0] === deck.last) {
        [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
      }
      deck = { remaining, last: deck?.last || null };
      topicSpeechHistory.set(topic, deck);
    }
    const speech = deck.remaining.shift();
    deck.last = speech;
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
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js?v=89').catch(() => {});

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
