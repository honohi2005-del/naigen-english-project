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
    '意味と思索': [
      `I used to think I had to explain every feeling right away. Then one evening, after a long talk with a friend, even my usual walk home felt different. Nothing on the street had changed, but I was noticing it in a new way. I’m trying to give experiences a little time before I decide what they mean. Sometimes the meaning shows up later.`,
      `I’ve had plans go wrong and felt sure the whole day was ruined. A few weeks later, I could see that the awkward meeting had introduced me to someone I now trust. The mistake was still a mistake, but it had become part of a different story. I don’t think every bad thing has a hidden benefit. I just try not to judge the whole story too soon.`,
      `The choices I make don’t come from me alone. A quiet room helps me focus, a good conversation changes my mind, and having the right tool nearby can make an idea feel possible. Then what I do affects the people around me too. I find it useful to notice those small connections. They remind me that our everyday surroundings are part of how we become ourselves.`,
      `When someone asks what a moment meant to me, I’m trying not to give the quickest, neatest answer. I might say what I noticed and what I still can’t explain. That can feel a little awkward, but it leaves room for more to come up. I’ve found that talking it through sometimes helps me see a connection I didn’t notice when it happened.`,
      `I often want to decide right away whether a day was good or bad. But a plan that fell apart once led to a friendship, and a fun evening sometimes feels empty the next morning. I’m learning to let a moment be what it was without giving it a final score. I may understand it differently later, and that’s okay.`,
      `A map is great when I’m trying to find a place, but it can’t tell me what the air smells like after rain or which café feels welcoming. For that, I have to walk around, listen, and take it in. Reading about a place gives me some facts; being there gives me a different kind of knowledge. My body notices things a map leaves out.`,
      `Sometimes I forget the exact words someone said, but I remember that I started listening more patiently afterward. Maybe a sentence helped me without becoming something I can quote. I notice its effect later, in how I react to a mistake or talk to a coworker. These days, I care less about remembering every line and more about whether it changed something I do.`,
      `My apartment looks different when only the kitchen light is on. The shadows make familiar things a little hard to recognize, so my mind starts guessing what I’m seeing. I used to think that being sure was always better. Now I enjoy those moments when I don’t know right away. I can look again, remember, and change my mind without needing to solve everything.`,
      `I can’t decide what other people will do, and some parts of life arrive without asking. But when a choice is mine, I want to be honest about what I’m taking on. I also want to admit when I can’t or don’t want to do it. To me, being responsible isn’t saying yes to everything. It’s understanding what my answer will mean and standing by it.`,
      `I can plan what I want to say in a conversation, but the other person might tell a story that takes us somewhere else. If I stick too closely to my notes, I miss the interesting part. I like it when we build an idea together, one reply at a time. It doesn’t mean the conversation has no direction; we’re finding the direction as we go.`,
      `I had a disagreement with my sister last month, and I kept trying to decide who was right. A few days later, I noticed I was listening to her differently. The problem was still there, but the conversation had changed what I paid attention to. I’m trying to let a moment have more than one meaning instead of forcing a quick conclusion.`,
      `Sometimes I leave a conversation without knowing whether we agreed. On the train home, I remember a small detail and see the whole exchange differently. Meaning doesn’t always arrive as a clear answer; it can grow between what I said and what the other person heard. I’m okay with letting that process continue after the conversation ends, even if some questions remain.`,
      `I used to think my habits were just personal choices. Then I moved to a noisier street and found it harder to read before bed. A small change in my surroundings changed what felt easy. It made me notice how much a place shapes my everyday life. I’m still myself, but I’m also responding to the people and things around me.`,
      `Not every experience needs to become a lesson. Some days are simply tiring, and I don’t have to turn them into a story about personal growth. I can eat dinner, call a friend, and get some sleep. Later, I might understand the day differently, or I might not. Letting it stay ordinary can be a relief. That feels good enough for now.`,
      `I can’t know how a decision will turn out, but I can be honest about why I’m making it. That feels more useful than waiting for complete certainty. If things change, I can respond then. For now, I want to choose with the information I have, accept what follows, and remember that other people are part of the situation too.`
    ],
    '学びと思考': [
      `When I try something new, I’m usually bad at it for a while. That’s not a reason to quit; it’s a chance to spot one thing I can change. I ask for feedback, try again, and compare what happened with what I expected. Repeating the same move without paying attention doesn’t help much. The useful part is making the next attempt a little different.`,
      `I used to think school was about collecting answers and moving on. Now I see it more like travelling with people who notice things I would have missed. A class can give me a starting point, but a new way of looking at things sticks around long after the lesson. Getting an answer feels good. Finding a better question can be just as useful.`,
      `I never learned to make bread by reading a recipe alone. I watched my aunt press the dough, turn it, and check how it felt, then I tried it myself. She corrected a couple of things, and I tried again. The instructions helped, but watching her hands taught me more. Some skills make sense only after you see them and give them a go.`,
      `I like using a notebook, but a page full of boxes for the right answers can make me stop asking questions. My favorite notebook has space for a rough idea, a mistake, and something I want to come back to. It doesn’t teach me by itself. It makes it easier to explore at my own pace, even when nobody is there to tell me what to do.`,
      `A movement can look easy when someone skilled does it, but copying the shape isn’t always enough. I have to notice where their balance is, when they move, and how the effort travels through the body. That idea helps me with music and language too. The parts matter, but I learn more when I see how they fit together in real time.`,
      `A lesson might last an hour, but most of my learning happens later. I’ll remember a question on the bus or try something from class while cooking dinner. That’s why one clear example can be more helpful than racing through a whole chapter. A good lesson gives me something to notice in ordinary life, then leaves me room to keep exploring it.`,
      `At a workshop, I learned a lot when the instructor made a mistake and showed us how to fix it. They didn’t panic or pretend it hadn’t happened. They paused, worked out what went wrong, and tried again. That gave me a useful example of how to handle my own mistakes. I want teachers who show how they think, not only how they get things right.`,
      `Learning guitar used to take all my attention. I had to think about every chord, and I still missed some changes. After a while, my fingers began finding the shapes on their own, so I could listen to the song and change the rhythm. Practice didn’t make learning stop. It gave me enough space to listen more closely to the whole song.`,
      `A test score tells me how many answers I got right, but it doesn’t tell me what to do next. I learn more when I look at the questions I missed and try to understand why. Maybe I misunderstood the wording, or maybe I need more practice. The result is useful if it helps me make a plan. It shouldn’t be just a label.`,
      `It can feel strange to try an idea that doesn’t match what I’ve always believed. I don’t need to agree with it right away. I can ask questions, listen to someone who sees it differently, and see whether it fits what I’ve experienced. I think learning means being willing to change my mind a little when new information gives me a good reason.`,
      `When I ask for feedback, ‘How was it?’ is usually too broad. I get more useful advice when I ask about one thing, like whether my explanation was easy to follow. Then I can try that suggestion in the next conversation. I don’t need to fix everything at once. A small, specific change gives me something real to practice for now.`,
      `I save articles and notes because I think I’ll need them later. But finding a quote again isn’t the same as knowing what it means to me. I understand an idea better when I try it in a conversation or connect it to something I’ve experienced. The note can remind me where to look; the learning happens when I work with it.`,
      `Watching someone do an ordinary task can teach me more than a long explanation. My neighbor showed me how she keeps her plants healthy by checking the soil before watering. I tried it at home and got a few things wrong. Seeing her notice the small signs helped me understand what to look for. Now I can adjust without asking every time.`,
      `The tools I use can make a task feel easier or harder. A language app gives me quick practice, but a real conversation makes me notice when I need to ask someone to repeat a phrase. I like having both. One lets me work alone, and the other helps me learn with people. Choosing the right tool changes what I’m able to try.`,
      `A mistake on a practice quiz used to feel like proof that I hadn’t learned enough. Now I look at what happened: did I guess, misunderstand, or forget a detail? That answer gives me a better next step than the score alone. I still want to improve, but I don’t need every attempt to go well for practice to be useful.`
    ],
    '行動と内省': [
      `I’ve noticed that I sometimes start a familiar task before I’ve really looked at what’s happening. In practice, I try to pause for a second and see what the other person is doing first. That small pause helps me avoid giving the same old response automatically. I’m not trying to control every move. I just want to meet what’s in front of me.`,
      `Before a difficult conversation, I breathe out slowly and feel my feet on the floor. I’m not trying to become perfectly calm; I just want enough space to listen. When my shoulders drop, I don’t rush to fill every silence. I can still say what I need to say. Sometimes getting ready is less about adding effort and more about letting go of the extra tension.`,
      `Making a plan helps, but it can’t promise that everything will go the way I want. I’m learning that trusting someone means accepting some uncertainty while still knowing my limits. If things go badly, I’ll deal with the result. That doesn’t automatically mean I was foolish to trust them. I want to take reasonable care and still leave room for other people to surprise me.`,
      `When someone moves toward me quickly, I used to watch only their hand. Now I try to notice their balance, direction, and the space between us too. I can’t know exactly what they’ll do, but seeing more of the situation helps me choose a response. Watching carefully isn’t the same as freezing. It gives me a little more time to move in a useful way.`,
      `If I keep telling myself to move perfectly, I usually get stiff. A teacher once asked me to pay attention to the floor instead of checking every part of my body. My balance got better, even though I wasn’t thinking about each joint. I still need to pay attention, but too much self-correction gets in the way. Sometimes practice works best when I let my body do its job.`,
      `After I mess something up, I can replay it all evening and call that learning. Usually I’m just making myself feel worse. A better review is to ask what happened, whether I need to fix anything, and what I’ll try next time. Then I try to stop going over it. Taking responsibility matters, but I don’t have to punish myself for hours.`,
      `Some afternoons, I have nothing planned and start feeling like I should fix that. Lately, I’ve been trying to leave the empty time alone for a bit. I might notice I’m tired, feel like going outside, or remember something I enjoy. Rest doesn’t have to be earned by finishing a long list. A quiet hour can help me figure out what I actually want to do.`,
      `When I come back to an activity after a break, I want to prove I haven’t lost my touch. That usually makes me rush and feel tense. It goes better when I start slowly and see what I still remember. Maybe some things are rusty, and that’s fine. Beginning again doesn’t mean I failed. It means I’m checking in with the body I have today.`,
      `Someone glanced at their phone while I was talking, and I immediately started speaking faster. Then I realized I didn’t know why they looked away. Maybe they got a message; maybe they were distracted. I took a breath and kept going at my own pace. Other people’s reactions are useful to notice, but I don’t have to react before I understand them.`,
      `I used to think getting better always meant working harder. Sometimes, after enough practice and a decent night’s sleep, a better way to do something just appears. I can’t force that moment, but I can give it a chance by showing up regularly and paying attention. I’m learning to trust the small adjustments that come to me when I stop overthinking every step.`,
      `When I’m avoiding a task, I sometimes make the first step smaller instead of giving myself a long speech. I open the document, write one rough sentence, and see how I feel. I may continue, or I may stop there. Either way, beginning gives me information. It’s easier to choose the next step once I’m actually in the situation for today.`,
      `In practice, I used to decide what I would do before my partner moved. Then I was busy following my own plan and missed what was happening. Now I try to watch their balance and direction first. My response is less predictable, even to me, but it fits the moment better. I’m learning to act from what I notice right now.`,
      `I used to feel guilty whenever I took an afternoon off. I thought I should be using the time to get ahead. But after a proper break, I often return with more patience and can finish things more clearly. Rest doesn’t solve every problem, and it won’t replace the work. It just helps me meet the work in a better state.`,
      `I noticed that I stir my coffee the same way every morning, even when I’m in a hurry. It’s a tiny habit, but it reminded me how quickly my body repeats familiar actions. When I want to change something bigger, I try to pause and notice what I’m already doing. That makes it easier to choose a different next move.`,
      `When plans change at the last minute, I can feel myself trying to solve everything immediately. I’m practicing taking one breath and checking what actually needs attention first. Maybe there’s a call to make; maybe I can wait for more information. I don’t have to feel calm before I act. A little space helps me respond instead of rushing for the moment.`
    ],
    '発音と身体': [
      `Before I start talking, I try to breathe out gently instead of holding my breath. Then I take a small breath in and begin. My throat feels less tight, and the first few words come out more easily. I still have to figure out what I want to say, of course. But letting my breath settle first makes it easier to use my voice without forcing it.`,
      `When I read a sentence out loud, I don’t want it to sound like a list of separate words. I listen for where I might pause and which words need a little more time. The rhythm can make the sentence easier to follow, even if my pronunciation isn’t perfect. A short pause gives the listener a chance to catch up and gives me a chance to breathe.`,
      `I used to raise my voice when I wanted people to take me seriously. It got their attention, but sometimes it made the conversation feel tense. Now I try to speak clearly without taking up all the space. If I leave a little room after I finish, the other person can join in. I’ve found that a steady, relaxed voice can sound more confident than a loud one.`,
      `Even when a recording sounds very clear, I like hearing the little details that make a voice feel human. There might be a breath before a word or a sound that takes a bit of effort. Those small things remind me that a real person is speaking. When I listen that way, I pay more attention to my own voice and how it feels to the person hearing it.`,
      `If a word sounds strange, I used to squeeze my mouth tighter and try again. Now I check what my tongue and breath are doing, and whether I’m rushing through the whole phrase. Sometimes one small change is enough. Pronunciation isn’t just about making each sound by itself. My mouth, breath, and timing all have to work together, which takes regular practice.`,
      `My voice didn’t improve after one great lesson. It changed through ordinary conversations, a few recordings I didn’t like, and trying again the next day. I began to notice when I was rushing or holding my breath. Every situation taught me something slightly different. I’m glad I kept practicing, because a voice gets more comfortable through use, not by waiting for the perfect moment.`,
      `I’ve heard people give a very polished explanation that was hard to follow. Sometimes one pause or a slower ending would have helped more than another sentence. When I’m speaking, I try to notice whether the other person is keeping up. My voice works better when I pay attention to them too. Clear communication depends on the words, but also on timing and listening.`,
      `A strong voice doesn’t have to be loud. If I stand comfortably and let my breath move, people can hear me without my neck getting tight. I notice the difference when I record myself: a forced voice sounds tense, even if it’s clear. I’m practicing speaking from a comfortable posture and letting the sound carry naturally. It feels easier for me and easier to listen to.`,
      `A song can feel completely different when the singer holds one note a little longer. I think everyday speech works the same way. A short pause can make a sentence feel thoughtful instead of impatient. When I practice, I try to hear the whole rhythm, not just check each word. I still care about clear pronunciation, but I want it to sound like something a person would actually say.`,
      `When the person I’m talking to seems tense, I can feel my throat tighten too. I used to match their pace without thinking. Now I try to notice what’s happening and let out a softer breath before I reply. The conversation might still be difficult, but I can choose a calmer tone. That small change can make it easier for both of us to keep talking.`,
      `I recorded a short voice message and was surprised by how fast I sounded. I hadn’t felt rushed while speaking, but the recording made it obvious. I tried again with a small pause after the first sentence. It felt more natural, and the message was easier to follow. Listening back helps me notice things I don’t catch while I’m talking.`,
      `On a video call, I sometimes speak louder when the connection is poor. That doesn’t always make me clearer; it can make me sound annoyed. Now I check the microphone and ask if the other person can hear me before changing my voice. Clear speaking depends on the situation too. I don’t need to push harder when a simple adjustment will help.`,
      `I can usually tell when someone is ready to speak because their breathing and timing begin to change. If I keep talking through that moment, the conversation feels crowded. I’m trying to leave a little space after I finish a thought. A pause can feel long to me, but it gives the other person time to join in naturally too.`,
      `Before an important call, I used to rehearse every sentence and then rush through them. These days I write down two points and let the rest come out in the conversation. My voice sounds less tight when I’m listening instead of trying to remember a script. I still prepare, but I leave room to respond to what the other person actually says.`,
      `I’m trying to notice how my voice feels, not only how it sounds. If my jaw is tight or I’m holding my breath, the words come out less easily. I don’t need perfect posture, but relaxing my shoulders can help. Small changes in the body affect the sound. Paying attention makes speaking feel more comfortable and more like my own.`
    ],
    '表現と学習': [
      `When I improvise, I can’t just do anything and expect it to work. The audience has been watching and remembering what happened earlier in the scene. I try to notice what they might expect, then make a choice that gives them something new to follow. Surprise is more fun when people are there to see it. I need to pay attention to them, not just myself.`,
      `When I first learned a dance, I copied the teacher’s steps as closely as I could. That helped me get the rhythm into my body. Later, I changed one turn because the original felt awkward for me, and it still fit the music. Copying was a useful start, but it wasn’t the end. I needed practice before I could make the dance feel like mine.`,
      `Learning a language reminds me of joining a group conversation that started before I arrived. People have their own ways of taking turns, joking, and showing they’re interested. A dictionary helps with the words, but talking with people teaches me when to use them. I learn more by joining in and paying attention than by memorizing every phrase on my own.`,
      `The first time a performer does something unexpected, the audience might love it. If they repeat the same surprise every night, people start waiting for it. I don’t think that means the idea is bad; it just means the performer has to keep paying attention. The audience remembers what came before. A small change in timing can make a familiar moment feel fresh again.`,
      `A small pause can make a character feel more real than a long speech. Maybe they’re trying to find the right words, or maybe they’ve just noticed something. I like watching the details: where someone looks, when they breathe, and how they finish a gesture. Those choices give the audience something to picture. A performance feels believable when the little actions make sense.`,
      `When I teach a new movement, explaining every detail first can leave people watching me for instructions instead of looking at what I’m doing. I try to show the whole thing, then let them have a go. They can ask questions and adjust it as they practice. Words are useful when someone gets stuck, but watching and trying often make the movement easier to understand.`,
      `I like conversations where the other person changes what I was about to say. It means I’m listening, and we’re finding the next idea together. If we’re both just waiting to show how clever we are, the talk gets boring fast. A shared pause can be part of the conversation too. Listening isn’t time spent doing nothing; it’s how the conversation moves forward.`,
      `Rules can feel annoying until I see what they make easier. If a scene has only two chairs and a few lines, I start noticing the small choices: who sits down, who waits, and what they leave unsaid. The limits help me focus. Then one unexpected move can stand out more. I like finding room to be creative inside a simple set of rules.`,
      `I can copy someone’s accent and still not sound like myself. My way of speaking develops from the phrases I use, the pauses that feel natural, and things I’ve experienced. Learning grammar and vocabulary gives me more choices, but I don’t have to sound like a perfect copy of another person. A personal style takes practice, and it gets clearer as I keep using the language.`,
      `Sometimes a performer looks at an empty chair, and I start imagining who might have been sitting there. The person is never shown, but the moment gives me enough to make up my own story. I like that kind of space in a performance. The performer makes a few clear choices, then lets the audience fill in some of the picture for themselves.`,
      `A joke I used with friends didn’t get a laugh the second time. I could tell they remembered it, so I changed the ending instead of repeating the same surprise. That made the moment feel alive again. When I’m performing or telling a story, I want to remember that the audience is part of what’s happening. Their attention changes what I do next.`,
      `When I’m learning a new recipe, I watch someone make it before reading every instruction. Then I try it myself and adjust when the dough feels too dry. The written steps still help, but the experience is more than following them in order. I learn by watching, trying, and noticing what happens. That process gives me room to develop my own way.`,
      `Some of my best conversations have started with a small misunderstanding. We explain what we meant, laugh a little, and end up talking about something neither of us planned. I like that the direction isn’t fixed from the start. Each person adds something, and the next idea grows from it. A conversation feels more interesting when we make it together.`,
      `I used to think having a personal style meant doing something completely original. Now I think it can come from repeating the basics until they feel natural, then making small choices that fit me. The structure gives me something steady to work with. I can change the timing, wording, or emphasis without losing the shape of what I’m trying to express.`,
      `When I explain an idea, I try to give one clear example and let people think about it for a moment. If I explain every detail, there’s no room for them to connect it to their own lives. I like when someone responds with a story I hadn’t considered. Sharing an idea is not only passing information along; it can start something new.`
    ],
    '社会と人との関係': [
      `I moved to a new neighborhood last year and expected it to feel strange for a long time. Then the shop owner started remembering what I usually buy, and a neighbor waved to me every morning. Nothing dramatic happened, but those small moments changed how the street felt. A place becomes home through ordinary contact, not just by knowing the address.`,
      `Trust isn’t the same as being sure nothing will go wrong. When I rely on someone, I know they might disappoint me, and I still decide the connection matters. That choice feels more honest than trying to control every outcome. I can set limits and speak up if something hurts, while leaving enough room for people to surprise me in a good way.`,
      `I used to think a good meeting needed a clear agenda and quick decisions. Then I noticed how much we learn in the moments between the official points: someone pauses, another person changes their tone, and the room relaxes. Those details rarely appear in the notes, but they affect what people feel able to say. Sometimes the atmosphere is part of the conversation.`,
      `I feel different around people who don’t turn every hobby into a competition. We can try something, get it wrong, and laugh without worrying about who is ahead. That kind of group gives me space to notice what I actually enjoy. It’s easier to keep showing up when I don’t have to prove that I’m improving every single time we meet.`,
      `A phone can make it easier to stay in touch, but it also decides what gets my attention if I’m not careful. I’ve started turning off a few alerts and choosing when to check messages. It’s a small change, yet I feel less pulled around by other people’s timing. The tool is more useful when I’m the one deciding how to use it.`,
      `I used to say yes whenever someone asked for help, even when I was already tired. Then I would feel resentful and blame them for asking. Now I try to answer honestly, including when I can’t take something on. Saying no is uncomfortable, but it makes my yes more meaningful. A relationship can handle a limit better than a promise I don’t want to keep.`,
      `The way we act at work isn’t only about personality. The room, the schedule, and even where people sit can make some choices easier than others. When a team keeps missing the same detail, blaming one person may not help. We could first look at how the work is set up. Changing the setting can sometimes change what everyone is able to do.`,
      `When someone seems tense, my first reaction is often to tense up too. I’m trying to notice that response before it takes over. If I keep my breathing easy and listen without rushing to fix things, the other person sometimes settles as well. I can’t control how they feel, but I can choose not to add more pressure to an already difficult moment.`,
      `Some of my favorite stories about friends began with plans going wrong. We missed a train, found a small café, and ended up talking for hours. The original plan mattered less than what happened after it fell apart. I like remembering that a shared experience doesn’t have to follow a script. People can make something worthwhile from an unexpected turn together.`,
      `Not every social gathering needs to be exciting to be worth attending. Sometimes I’m glad just to sit with people, eat something simple, and hear about their week. I used to worry that a quiet evening meant we had nothing in common. Now I think being comfortable without constant entertainment can be its own kind of connection, simply by being together.`,
      `I learn a lot from watching how someone handles an ordinary problem. A teacher who admits a mistake or a colleague who asks a careful question gives others permission to do the same. Advice can be useful, but the way a person lives often makes a stronger impression. People notice what we do, especially when our actions match the values we talk about.`,
      `Labels can help us describe patterns, but they can also make us stop being curious about a person. If I decide someone is “always difficult,” I may miss what is happening today. I’m trying to leave a little space between the label and the person. That doesn’t mean ignoring a problem; it means checking what is actually going on before I react.`,
      `A neighborhood festival may look like a tradition that never changes, but every year people bring something new to it. Someone starts a different game, a family shares a new dish, and the old routine gets a fresh meaning. I like that communities can keep familiar things while adapting them. A tradition stays alive because people use it, not because it is frozen.`,
      `In a conversation, I notice more than the words. A short pause, a glance toward the door, or a softer voice can tell me that the topic has changed for someone. I don’t always read those signs correctly, so I try to check instead of assuming. Paying attention makes it easier to adjust and lets the other person shape where the talk goes next.`,
      `It’s easy to talk as if society were something far away, made only of laws and big institutions. But it also shows up in the hours we work, the tools we depend on, and the small ways we treat each other. I can’t change everything alone. Still, the choices I make with other people can support a more livable way of doing things.`
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
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js?v=91').catch(() => {});

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
