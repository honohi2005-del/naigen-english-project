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
    topicSpeechButtons: $('topic-speech-buttons'), topicSpeechCard: $('topic-speech-card'), topicSpeechTitle: $('topic-speech-title'), topicSpeechText: $('topic-speech-text'), topicSpeechIndex: $('topic-speech-index'), topicSpeechWordCount: $('topic-speech-word-count'), topicSpeechGenerate: $('topic-speech-generate'), topicSpeechPlay: $('topic-speech-play'), topicSpeechStatus: $('topic-speech-status'),
    modeLabel: $('mode-label'), number: $('item-number'), topicLabel: $('item-topic'), source: $('source-page'), en: $('english-quote'), enJa: $('english-japanese'), speak: $('speak-button'), pause: $('pause-button'), modelSpeed: $('model-speed'), repeatTwice: $('repeat-twice'), modelLoop: $('model-loop-button'), speechStatus: $('speech-status'), previous: $('previous-button'), previousTen: $('previous-ten-button'), previousFifty: $('previous-fifty-button'), next: $('next-button'), orderedNext: $('ordered-next-button'), nextTen: $('next-ten-button'), nextFifty: $('next-fifty-button'),
    series: $('series-bar'), seriesStatus: $('series-status'), stop: $('series-stop'), record: $('record-button'), recordStatus: $('record-status'), recordList: $('record-list'), recordAll: $('record-play-all'), recordTrio: $('record-model-trio'), recordClear: $('record-delete-all'), recordCount: $('record-count'), install: $('install-button')
  };
  let mode = 'random', current = null, series = null, seriesTimer = null, quoteAudio = null, quotePlaybackActive = false, speechVersion = 0, recorder = null, recordingParts = [], recordStream = null, allRecords = [], playbackQueue = [], playbackAudio = null, recordPlaybackRun = null, trioPlayback = null, recordObjectUrls = [], installPrompt = null, recordingStarting = false, recordSavePending = false, recordDeletionPending = false;
  let randomHistory = [], randomHistoryPos = -1;
  let topicSpeechActive = false, topicSpeechVersion = 0, topicSpeechAudio = null, topicSpeechManifestPromise = null;
  const topicSpeechSlugs = { '意味と思索': 'meaning', '学びと思考': 'learning', '行動と内省': 'action', '発音と身体': 'voice', '表現と学習': 'expression', '社会と人との関係': 'society' };
  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let modelPlaybackRate = 1;
  let dbPromise;
  const functionWords = new Set(`a an the i me my you your yourself we our ourselves they them their themselves he him his she her it its this that these those who whom whose which what when where why how another each every either neither all no any some as at by for from in into of on onto out over under with within without after before against between beyond through to than like and or but so because if while although though unless until whether then instead rather not do does did can cannot could may might must shall should will would am is are was were be been being has had ought`.split(' '));
  // Each entry is a complete, independently written B2-level speech inspired by this topic's maxims.
  const topicSpeechSets = {
    "意味と思索": [
      "Meaning does not always arrive as a neat answer. Sometimes a phrase changes how the present moment feels, even after its exact wording has faded. I like that idea because it leaves room for life to be understood through experience, not just explanation. A word matters when it helps us notice something we could not quite see before. I can leave meaning open while I notice what remains.",
      "We often want every experience to mean something clear. But uncertainty can be useful too. It keeps us from turning one difficult moment into a permanent label for ourselves. A story can hold mixed feelings and unexpected changes without pretending they were planned. Maybe understanding begins when we let an experience stay complicated for a little while. More than one meaning can grow from the same experience.",
      "A body is not just a container for ideas. It is where the world becomes touch, sound, tension, warmth, and movement. Thinking about meaning this way changes the question from what does life mean in general to what is happening in this moment. The answer may be small, physical, and still worth paying attention to. Some things become clearer when I give them enough time.",
      "It is tempting to treat identity as a solid thing we must protect. Yet our sense of self shifts with relationships, places, and whatever we are paying attention to. That does not make us unreal. It means we are responsive. I find more freedom in asking what is taking shape now than in trying to defend one fixed picture of myself.",
      "Not knowing can feel frustrating, especially when we want a quick explanation. Still, a little uncertainty keeps our attention open. We can listen longer, notice details, and let a better question appear. There is no need to turn every pause into a failure. Sometimes the most honest thing we can say is that we have not understood it yet. Uncertainty can be part of understanding, not reason to stop.",
      "The same event can feel different when we meet it from another angle. That does not mean facts are meaningless; it means our attention helps shape what becomes important. A useful story can bring surprising details into view and give them somewhere to belong. I want stories that make life more workable, not ones that explain everything away. Meaning can emerge slowly from the details I almost overlooked.",
      "Words can help us understand an experience, but they can also close it too soon. A quick label may make uncertainty easier to manage while hiding what is actually happening. It helps to pause before naming everything. We can notice our breathing, surroundings, and reactions first, then choose words that stay close to what we can honestly say. The story stays alive when I leave room for change.",
      "When I try to control every feeling with an explanation, I miss how it is changing in my body. Emotions often arrive gradually, through shifts in attention, breath, and energy. They do not always need a perfect reason before we can notice them. Letting a feeling move at its own pace can tell us more than arguing with it. I am allowed to keep a question open for longer.",
      "The world is not something we only look at from a distance. We touch it, move through it, and are changed by what pushes back. Our surroundings shape what seems possible, while our actions alter those surroundings in small ways. Knowing the world may begin with contact: a real response between a living body and what it meets. A moment need not be solved before I can learn.",
      "It is easy to believe that saving a thought means we have learned it. A note can preserve the words, but it cannot do the work of letting them change how we notice and act. The deeper question is what remains in our habits after the sentence is forgotten. Memory matters most when it becomes part of how we live.",
      "A mistake does not have to become a story about who we are. We can recognize what happened without repeating the scene in our minds for days. That leaves room to respond, repair what can be repaired, and move on. Meaning is not the same as blame; sometimes it is simply the next choice we make with care. An unfinished thought may still be worth carrying with me.",
      "Art may be less like a finished object and more like something that keeps happening. A gesture, a pause, or a change in attention can make an ordinary moment feel newly present. This view does not make the object worthless. It reminds me that its meaning also depends on what bodies notice, remember, and bring to it. I do not need to name every feeling immediately today.",
      "Life includes endings, and pretending otherwise can make them harder to face. If we see ourselves as part of a larger flow, an ending can belong to life without being called easy or pleasant. That perspective offers no simple comfort. It only makes space for change, grief, and the fact that living things cannot hold still forever. A new question can change how the old answer looks.",
      "A useful idea is not always the one that sounds most certain. Sometimes it is the one that helps us stay with a real question instead of covering it with familiar language. I want to use concepts as tools for looking, not as walls around experience. The moment a theory stops helping us notice, it may be time to loosen it.",
      "We do not need to meet every expectation to have a life that feels real. Other people's hopes may shape us, but they do not have to decide every next step. I can listen without handing over my whole sense of direction. There is value in noticing what matters to me before turning it into a performance for anyone else."
    ],
    "学びと思考": [
      "Learning a language is more than collecting rules. It means becoming able to join a shared activity, notice what others are doing, and respond in ways that make sense there. Grammar helps, but it cannot prepare us for every moment. We also need practice hearing patterns, trying them out, and adjusting through real interaction. Practice teaches me things that an explanation alone cannot show.",
      "Watching someone skilled can teach us things that an explanation cannot. We notice timing, pressure, small changes, and what happens just before an action. Then we try, get feedback, and try again. Words can point toward a useful detail, but learning often depends on seeing and feeling how the whole action comes together. I learn more when I try, notice, and try again.",
      "A test is useful when it gives us something to learn from. A score alone cannot tell us what to do next, and a weak result does not have to define our ability. It is better to look closely at which questions caused trouble and what kind of practice might help. The result matters when it changes our next attempt.",
      "Finishing a book is not the only way to make progress. We can stop at a meaningful point without treating the rest as a debt. The amount completed is only one measure; choosing where to pause is part of learning too. A clear stopping place can help an idea settle and make it easier to return with fresh attention. Feedback can change the way I approach the next attempt.",
      "A good teacher cannot control every moment of a student's attention. What happens in class matters, but much learning takes place later, when students are on their own. Class time can offer a useful question, a model, or a new way to look. The goal is to change what learners notice and try after the lesson ends. Understanding grows when I connect ideas to what I do.",
      "People learn more than instructions. They watch how others handle uncertainty, make choices, and respond when something goes wrong. That is why a teacher's example matters alongside the lesson plan. A living model does not provide a script to copy exactly; it gives learners something concrete to observe, question, and adapt to their own situation. I need room to experiment, not only steps to follow.",
      "A tool can make learning easier or quietly decide what kind of learning is possible. If it gives people room to explore, make choices, and understand their own actions, it supports independence. If it only directs every step, learners may become dependent on the system. The design of a tool shapes the learner's role from the start. Skill develops through attention, repetition, and adjustments that fit me.",
      "We often learn by trying a form before we fully understand it. Repeating the pattern gives the body and mind time to notice what words alone cannot explain. Later, the learner can make the form their own. Practice is not just preparation for understanding; sometimes it is the way understanding begins to take shape. A lesson matters when it changes what I notice afterward.",
      "It helps to step outside the ideas that already feel comfortable. That does not mean rejecting everything familiar or chasing novelty for its own sake. It means allowing a different view to test what we assumed. This willingness can be learned through small choices: ask another question, listen longer, or try a method that does not feel automatic yet. I can leave a book unfinished and still carry forward.",
      "When a skill becomes more automatic, attention is free to move elsewhere. A learner who no longer has to plan every small movement can notice timing, meaning, or the other person. This does not mean practice is over. It means one part of the work has settled enough for a new question to become visible. The next question often appears while I am practicing alone.",
      "A lesson should not treat a person as a set of separate abilities that can all be taught in isolation. Real action depends on the body, the surroundings, other people, and the task at hand. Breaking things down can help, but the pieces still need to come back together. We learn best when practice reconnects them to use. I learn by seeing, trying, and hearing what really changed.",
      "Feedback works best when it gives us something specific to try. General praise or criticism can be hard to act on, while one clear observation can change the next attempt. We do not need to fix everything at once. Notice one detail, test a small adjustment, and pay attention to what changes. That is a practical way to keep learning.",
      "A person can imitate a model and still bring something personal to the result. At first, copying gives us access to a pattern we could not invent alone. With practice, the pattern meets our own body, voice, and choices. Learning does not end when we can reproduce the example; that is often when our own style can begin. Teaching helps when it leaves space for learners to discover.",
      "Remembering a fact is different from being able to use it at the right time. We need chances to bring knowledge into different situations and see what still works. That process can feel less tidy than memorizing a list, but it creates more flexible learning. The point is not only to recall information; it is to respond with it. I can remember a practice through what my body learned.",
      "Sometimes the best learning happens when there is no immediate result to show. A question can stay with us while we work, talk, or rest, and a connection may appear later. We cannot force every insight on schedule. It helps to give ideas time, while staying curious enough to recognize them when they arrive. Progress is not a straight line, and practice still matters."
    ],
    "行動と内省": [
      "Starting can be the achievement for today. When a task feels too large, waiting for motivation often makes it heavier. A small beginning gives us information: what the work is like, where it catches, and what might come next. We do not have to promise a perfect finish before we begin. The first step can be enough to change the situation.",
      "When we focus too hard on controlling each movement, the whole action can become stiff. It may help to sense the larger shape of what we are doing and let familiar skills support us. Attention still matters, but it does not have to micromanage every part. Sometimes a little less control makes room for a more coordinated response. A small change in posture can shift the whole movement.",
      "Old habits are useful until they keep answering a situation that has changed. If a response feels late or forced, it may be worth noticing what familiar pattern took over. We can look for a different cue rather than simply trying harder. A small change in timing or attention may help the next movement become more available. I can notice tension without letting it choose my move.",
      "Effort does not always mean adding more force. When we tense one part of the body, other parts may have to compensate, and the action can lose its balance. A quieter center and a softer grip can let power travel with less strain. The useful question is not how hard can I push, but what is preventing movement from flowing.",
      "If a movement feels unnatural, self-criticism usually adds another layer of tension. Instead, we can ask what conditions make the action easier to sense and adjust. Perhaps the pace is too fast, or attention is too narrow. Trying a different setup gives us a way forward. We learn more from a small experiment than from repeating the same judgment. I feel the ground under my feet before I move.",
      "The beginning of an action can shape everything that follows. A breath, a shift of weight, or a glance may prepare the body before the obvious movement starts. Paying attention to that preparation can make action feel less rushed. We do not need to add a dramatic gesture; often the clearest change is a more settled start. Looking outward helps me respond to what is actually happening.",
      "Being absorbed in a task does not require strain. We can stay alert while allowing some details to happen without constant commentary. Watching posture or breath lightly may help us notice what is changing, as long as the observation does not become another demand. The aim is a kind of attention that keeps us involved without making the body freeze.",
      "When we feel behind, forcing a faster response can make us even less able to read the moment. It may be more useful to return to the cue that is actually present instead of reacting to our idea of what should happen next. A little space between expectation and action can help us move with the situation, not chase it.",
      "A practice does not always need to become more intense to become more useful. Repeating an action with curiosity can reveal details that effort alone misses. We might notice where balance shifts or when the breath changes. Those observations offer practical choices. Enjoying the process is not a distraction from improvement; it can be what keeps attention available. When I pause, I can choose a more natural response.",
      "Some tasks get easier when we stop demanding that every attempt prove something about us. A single action can simply be an action: a line written, a phrase spoken, a step taken. That reduces the pressure to perform an identity. We can pay attention to what the task asks for now and leave the larger judgment for another time. The body finds an adjustment before words can explain it.",
      "The body often knows a transition before we explain it. Relaxation can give way to movement quickly when we do not hold on to extra tension. This does not mean being passive; it means keeping readiness without bracing too early. A responsive body can act decisively because it has not spent all its energy preparing for a threat that is not here.",
      "A pause is not always wasted time. It can give attention a chance to catch up with the body and let the next action become clearer. We may notice a sound, a shift in balance, or the other person's timing. Then movement can grow from what is happening instead of being pushed out by impatience. I can practice the beginning until it feels less hurried.",
      "Improvement becomes more natural when we know a skill well enough to notice the next small possibility. We do not have to invent a plan for every session. Curiosity may point out a place to adjust, then experience tells us whether it helped. The work is still ours, but ideas can come from close attention rather than pressure. Letting go of one habit can make another option visible.",
      "Self-observation can help, but replaying every mistake is not the same as learning. We can recognize an error, take the information it offers, and let the next attempt be new. Rehearsing blame keeps attention tied to what has already happened. A short review followed by a concrete next step is usually kinder and more useful. It helps to act from the present, not old momentum.",
      "A good action is not always the biggest or most noticeable one. Often it is the smallest movement that fits the moment and leaves room for what follows. When we stop trying to impress ourselves, we can sense whether the action is doing its job. Restraint is not a lack of energy; it can be precise timing. Relaxation and readiness can belong together naturally in one movement."
    ],
    "発音と身体": [
      "Before speaking, it can help to let the breath out fully and then take a light breath in. The throat may stay easier when it is not asked to hold extra tension. This is not a trick that guarantees a perfect voice. It is a simple way to give the body a calmer starting point and notice how speech feels.",
      "A voice can invite someone into a rhythm without trying to overpower them. When we push too much volume, we may lose the chance to hear the other person's response. A steadier voice leaves space for listening and adjustment. Speaking clearly does not require pressing harder; often it means finding enough support and letting the sound carry naturally. I do not need to push volume to sound engaged.",
      "Sound is something we can learn through the body, not only through technical labels. We can notice where a tone vibrates, how breath supports it, and what changes when the jaw softens. Those sensations give us practical information for the next phrase. Gradually, the body remembers a sound more reliably than a long list of instructions. Rhythm helps me speak without rushing ahead of the listener.",
      "Rhythm helps people feel how a voice is moving. A slight pause can make a thought easier to follow, while a steady pace can create a sense of ease. These choices are part of meaning, not decoration added afterward. When speaking feels rushed, listening for the rhythm may help us reconnect words with breath and attention. A quiet start can make the rest of speech easier.",
      "If the voice starts to feel heavy at the back, the sound may be losing its forward ease. Rather than forcing it louder, we can return to a comfortable breath and notice where the tone seems to travel. Small changes are easier to judge than a big push. The goal is a voice that stays available and responsive. When I pause, the sound can settle before I continue.",
      "Our posture can affect how easily breath and sound move. Instead of holding the body in a perfect pose, we can notice where unnecessary effort has collected. A small release in the shoulders or jaw may create more room for the next phrase. The body does not need to look impressive; it needs enough freedom to support speech. Clear speech comes from practice, not from extra force alone.",
      "Listening is part of speaking well. While we talk, we can notice the other person's face, pauses, and small changes in attention. That information can guide volume and pace. We are not reading minds; we are responding to visible cues. Speech becomes more connected when our own words leave enough attention available for the person receiving them. My voice can invite others without taking over the room.",
      "A clear sentence is easier to follow when each phrase has a shape. We can let important words receive a little more energy and allow smaller words to connect them. That does not mean exaggerating every accent or pause. It means giving the listener a path through the sentence, supported by breath, timing, and a relaxed mouth. I notice more by hearing how a phrase takes shape.",
      "Writing something by hand before saying it can help us notice what we actually want to express. The hand moves at a different pace from speech, leaving room to choose and revise. Then the spoken words can feel more grounded. The point is not to memorize a script exactly, but to let the thought settle into a form we can say.",
      "A familiar phrase can come out more easily when we stop treating every sound as a separate problem. Practice lets small movements join into a flow. Once that happens, attention can return to the listener and the meaning. The voice grows through repeated use, but the repetitions need enough variety to keep the sound connected to real communication. My words can reach a listener at a natural pace.",
      "When someone else is tense, it is easy for our own body to tighten in response. We can notice that pull without obeying it. If the breath stays easy, our voice may remain calm enough to make room for a different pace. We cannot control another person's state, but we can choose whether to add more pressure. A little space between ideas helps listeners follow each idea.",
      "A voice does not need to be loud to be present. People can hear steadiness in a sound that is well supported and directed toward them. Pushing can make timing less predictable and listening harder. It may help to use only the energy the phrase needs, then allow the next response to shape what comes after it. A sentence's sound matters as much as its chosen words.",
      "A short pause before speaking can help the body arrive with the thought. We do not have to fill every silence while an idea is forming. Letting a breath settle gives us time to notice what matters and how to say it. A pause can make speech feel more deliberate without making it formal or overly rehearsed. I can hear when my voice begins to press hard.",
      "The way we move while speaking can either crowd or support the words. A gesture may help when it grows from the thought, but extra motion can pull attention away. We can watch what the body is already doing and let it become simpler. Clear speech often comes from coordinated movement, not from adding more signals. Good timing lets a phrase carry meaning to another person.",
      "A natural speaking rhythm is not the same for everyone or every situation. Some thoughts need room; others become clearer when they move along. We can listen for the pace that lets both people stay involved. The useful measure is whether the sound carries attention and meaning, not whether it matches a fixed idea of confident speaking. My voice feels clearer when my body is not braced."
    ],
    "表現と学習": [
      "An example can show us what is possible, but copying it perfectly is not the end of making something. The pattern has to pass through our own attention, body, and choices. With practice, we begin to understand what can change and what gives the work its shape. That is where a personal style can start to appear. I enjoy working more when attention stays on the task.",
      "A performance is built moment by moment, so the future can offer clues about what to do now. We can imagine how an audience might receive a choice, then decide whether to follow or surprise that expectation. This is not about guessing perfectly. It is about staying aware of the people watching and letting their attention matter. Repeating a form can create room for new choices later.",
      "Improvisation does not mean that anything can happen without limits. We still work with time, bodies, materials, and the audience's memory. The interesting question is what remains possible inside those conditions. If we accept the limits honestly, a small choice can open a new direction. Freedom may come from responding to what is here rather than pretending there are no boundaries.",
      "A small, accurate action can make a scene feel true. Big emotion alone does not guarantee that an audience will believe it. People notice whether timing, gesture, and intention fit together. When each part has a clear reason, the whole can become convincing without being pushed. Attention to detail gives expression something solid to rest on. Small, accurate actions can make an imagined situation feel real.",
      "Showing how talented we are can become a distraction from what we are trying to express. The audience may see the effort to impress more clearly than the idea itself. It helps to ask what the moment needs, then let the work serve that need. Expression often feels stronger when we stop making ourselves the main subject. Each movement should stay clear and easy to follow closely.",
      "A style may look like a set of limits, but a familiar way of working can also free attention. When basic choices no longer need to be solved every time, we can explore more subtle changes. Skill gives us room to play. The goal is not to become trapped in a formula, but to make a form flexible enough to use.",
      "Repeating the same action does not always repeat the same meaning. The context shifts, our attention changes, and the audience brings its own memory. A familiar gesture can feel different because of what now surrounds it. That is one reason practice can stay alive: repetition gives us a stable shape in which new details can appear. I can follow a model and still make my choices.",
      "An audience is part of what makes a performance happen. Their attention, expectations, and memories affect how a choice lands. We cannot control exactly what they will think, but we can notice the rhythm of their response and adjust. Performing is not sending a finished message across a gap; it is working with the room as it changes. Timing and rhythm can change the feeling of simple words.",
      "Imitation is one way people pass skills and culture to each other. We observe, try, and slowly make a borrowed pattern fit our own way of moving. Copying does not have to erase individuality. The choices we make about what to notice, keep, and change can reveal something of ourselves even while we learn from another person. I learn a style by trying it in real situations.",
      "Emotion does not always need to be forced before expression begins. A clear tempo and rhythm can give the body enough structure for feeling to emerge. This is useful because it shifts attention from trying to look moved toward doing the small actions that shape the moment. The experience can grow from the work rather than being demanded in advance.",
      "Art is not only the object left at the end. It can also be the process of noticing, choosing, and responding while something is being made. That perspective makes room for uncertainty without calling the work meaningless. A finished piece matters, but so does the attention that brought it into being and the changes that happened along the way. I prefer an honest detail to a showy, empty display.",
      "Practice becomes less mechanical when we pay attention to how an action is made. The same line can feel different depending on where it begins, how it travels, and where it stops. Those details give the work a shape that can be sensed, not just described. Careful repetition builds clarity while leaving room for expression. A choice can come from less when timing feels right.",
      "A good story can take in something unexpected without pretending it was part of the plan. That flexibility matters in performance and in ordinary communication. We can keep the thread of what we are doing while making room for a new detail. A structure is useful when it helps us respond, not when it forces every moment into place. I want to leave space for a response from others.",
      "It is useful to study a model, but the work changes when we stop asking only whether it looks the same. We can ask what holds the example together: its timing, balance, focus, or relationship to the audience. Understanding those connections gives us more choices. Then practice becomes a way to develop the work, not merely reproduce its surface. Audience members help complete meaning by imagining what might follow.",
      "When movement is clear, each action has enough space to be noticed. Rushing can blur the parts together, while overexplaining can slow the whole thing down. A fitting pace lets the audience follow without removing every surprise. We can shape the timing so that details remain distinct and the overall expression still feels alive. A repeated gesture can feel new when its context changes."
    ],
    "社会と人との関係": [
      "A conversation is something people make together. Each person brings words, attention, pauses, and expectations, then adjusts to what comes back. Meaning does not sit in one speaker's head and travel unchanged. It grows between people as they respond. That is why listening is not a break from communication; it is one of the things that creates it. We create an atmosphere through small responses to one another.",
      "Trust always leaves room for uncertainty. We cannot control every future result or guarantee that another person will respond as hoped. Trust means choosing to act while accepting that risk as part of the situation. That can make our options wider, not narrower, because we no longer need perfect certainty before taking any step. Trust includes accepting that another person remains outside my control.",
      "Responsibility asks us to understand ourselves well enough to answer for a choice. It also matters that we could choose otherwise; responsibility is meaningful because refusal remains possible. This is not a reason to blame people for every condition around them. It is a reminder that ethical action involves both the limits we face and the choices still open to us.",
      "Face to face, people share more than information. Breath, timing, posture, and the mood of a room all affect what can be said and heard. Some of this happens without deliberate thought. That richness is easy to miss when we judge communication only by its efficiency. Human contact includes the unexpected details that make an exchange feel alive. Listening can make a difficult moment feel much less pressured.",
      "Tools shape how people take part in society. Some let us act, make things, and learn more independently; others organize our behavior and quietly decide what counts as normal. The difference is not only technical. It affects who has choices and who must follow a system. Asking how a tool is structured can reveal the relationships it creates. A community stays alive when people adapt its old routines.",
      "Social expectations can enter daily life through small routines and standards. Over time, people may begin to manage themselves according to rules that once came from outside. Noticing this does not mean every rule is harmful. It gives us a chance to ask who benefits, what is being limited, and whether another way of doing things could make room for more people.",
      "No one communicates from a completely separate world. Our words rely on shared habits, and those habits can change when people use them differently together. Language is not just a private possession; it is also part of the social space we build. Each exchange can repeat an old pattern or make a small adjustment to it. The way a place is arranged can shape everyone's choices.",
      "When another person is tense, matching that tension may seem natural. But a calm response can sometimes give the interaction more room. This is not about fixing the other person or pretending everything is fine. It is about choosing what we add to the moment. A little ease in one body can change what feels possible between two people. Asking one honest question can change what a group expects.",
      "People often want to explain another person's actions with a simple idea of free choice. Real decisions are also shaped by history, habit, health, and circumstances that may not be visible. Recognizing those influences does not remove all responsibility. It can make our judgments less quick and help us respond to people as more than a single action. Shared stories can connect people without making them all alike.",
      "Education is not simply reaching a fixed destination or proving that a person has a certain ability. It can change the ways learners see and participate in the world. That change may depend on teachers, tools, peers, and time outside class. Looking only for an individual result can hide the relationships that made learning possible. Quiet company matters even when nobody has much to say.",
      "People need not answer every expectation placed on them. Communities are held together by shared practices, but those practices can become demanding when no one is allowed to question them. We can take part without surrendering every boundary. A healthy relationship leaves room for response, refusal, and change on both sides. People learn values by noticing how we act around them.",
      "The atmosphere of a group can influence how people speak and move. It is not always captured by a formal rule or a list of outcomes. People notice tone, timing, and what seems welcome in the room. Paying attention to that shared feeling can help us understand why an interaction works, even when nobody has explained it aloud. An impression can change when I learn the fuller story.",
      "Human relationships cannot be reduced to exchanging useful information. People may understand each other through rhythm, gesture, and a sense of when to speak or wait. These details are not noise around the real message; they help make the message possible. A good conversation leaves space for both the words and the living people who use them. People make choices within conditions they did not choose themselves.",
      "A society can train people to fit its systems so smoothly that the arrangement starts to feel natural. It helps to notice how routines and tools guide behavior, especially when they appear neutral. We can then ask whether the system supports people's lives or mainly makes them easier to manage. That question is part of taking social life seriously. Sharing space affects who feels able to speak up today.",
      "Cooperation is not the same as agreement on everything. People can work together while bringing different needs and interpretations into the same space. The important part is being able to respond, adjust, and stay in relation without forcing one view to erase the others. Shared meaning often comes from that ongoing work rather than from a perfect consensus. Small acts of attention can make a place feel welcoming."
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
    if (topicSpeechAudio) {
      topicSpeechAudio.onended = null;
      topicSpeechAudio.onerror = null;
      topicSpeechAudio.onplaying = null;
      topicSpeechAudio.pause();
      topicSpeechAudio.currentTime = 0;
      topicSpeechAudio = null;
    }
    topicSpeechActive = false;
    ui.topicSpeechPlay.textContent = 'スピーチ音声を再生';
    if (message) ui.topicSpeechStatus.textContent = message;
  }
  function loadTopicSpeechManifest() {
    if (!topicSpeechManifestPromise) {
      topicSpeechManifestPromise = fetch('./audio/topic-speeches/manifest.json', { cache: 'no-cache' })
        .then(response => { if (!response.ok) throw new Error(`音声一覧 HTTP ${response.status}`); return response.json(); })
        .catch(error => { topicSpeechManifestPromise = null; throw error; });
    }
    return topicSpeechManifestPromise;
  }
  function renderTopicSpeech(topic) {
    stopTopicSpeech();
    const speech = topicSpeechSets[topic] ? generateTopicSpeech(topic) : '';
    ui.topicSpeechCard.hidden = !speech;
    ui.topicSpeechTitle.textContent = topic || '';
    ui.topicSpeechText.textContent = speech || '';
    const library = topicSpeechSets[topic] || [];
    const speechIndex = speech ? library.indexOf(speech) : -1;
    ui.topicSpeechIndex.textContent = speechIndex >= 0 ? `${speechIndex + 1}/${library.length}` : '';
    ui.topicSpeechIndex.setAttribute('aria-label', speechIndex >= 0 ? `スピーチ ${speechIndex + 1}/${library.length}` : '');
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
  async function playTopicSpeech() {
    if (topicSpeechActive) { stopTopicSpeech('読み上げを停止しました。'); return; }
    const text = ui.topicSpeechText.textContent.trim();
    if (!text) return;
    const topic = ui.topicSpeechTitle.textContent;
    const speechIndex = topicSpeechSets[topic]?.indexOf(text) ?? -1;
    const slug = topicSpeechSlugs[topic];
    if (!slug || speechIndex < 0) {
      ui.topicSpeechStatus.textContent = 'この英文に対応する音声が見つかりません。';
      return;
    }
    stopSeries();
    const version = ++topicSpeechVersion;
    topicSpeechActive = true;
    ui.topicSpeechPlay.textContent = '音声を停止';
    ui.topicSpeechStatus.textContent = '事前生成したスピーチ音声を読み込んでいます…';
    try {
      const manifest = await loadTopicSpeechManifest();
      if (version !== topicSpeechVersion) return;
      const audioAsset = (manifest.assets || []).find(asset => asset.id === `${slug}-${String(speechIndex + 1).padStart(2, '0')}`);
      if (!audioAsset) throw new Error('対応する音声ファイルがありません。');
      const audio = new Audio(`./audio/topic-speeches/${encodeURIComponent(audioAsset.file)}?v=${audioAsset.revision}`);
      topicSpeechAudio = audio;
      audio.loop = true;
      audio.onplaying = () => { if (version === topicSpeechVersion) ui.topicSpeechStatus.textContent = '英語スピーチを再生しています…'; };
      audio.onended = () => {
        if (version !== topicSpeechVersion || !topicSpeechActive) return;
        audio.currentTime = 0;
        audio.play().catch(error => {
          if (version !== topicSpeechVersion || !topicSpeechActive) return;
          topicSpeechActive = false;
          topicSpeechAudio = null;
          ui.topicSpeechPlay.textContent = 'スピーチ音声を再生';
          ui.topicSpeechStatus.textContent = 'スピーチ音声の再生を続けられませんでした。';
          console.error('Topic speech audio loop failed:', error.message);
        });
      };
      audio.onerror = () => {
        if (version !== topicSpeechVersion) return;
        topicSpeechActive = false;
        topicSpeechAudio = null;
        ui.topicSpeechPlay.textContent = 'スピーチ音声を再生';
        ui.topicSpeechStatus.textContent = 'スピーチ音声を読み込めませんでした。';
      };
      await audio.play();
    } catch (error) {
      if (version !== topicSpeechVersion) return;
      topicSpeechActive = false;
      topicSpeechAudio = null;
      ui.topicSpeechPlay.textContent = 'スピーチ音声を再生';
      ui.topicSpeechStatus.textContent = 'スピーチ音声を再生できませんでした。通信状況を確認してください。';
      console.error('Topic speech audio playback failed:', error.message);
    }
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
  ui.topicSpeechGenerate.addEventListener('click', () => renderTopicSpeech(ui.topicSpeechTitle.textContent || ui.topic.value));
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
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js?v=93').catch(() => {});

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
    button.addEventListener('click', () => renderTopicSpeech(topic));
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
