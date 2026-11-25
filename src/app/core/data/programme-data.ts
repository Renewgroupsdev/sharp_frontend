/**
 * Programme content carried over from the HTML prototype (student / mentor demo data).
 * Videos are referenced by key (v1...) - the prototype embedded them as base64; serve real files from assets/ later.
 */
/* eslint-disable */
export const STUDENT = {
  name: "Priya R", id: "SH2026-0412", init: "PR",
  college: "Fatima College, Madurai", course: "B.Com (CA) · 3rd Year",
  batch: "SHARP Batch 07", phone: "+91 98••• ••412", email: "priya.r@example.edu",
  joined: "June 2026", mentorName: "SG",
  mentorOrg: "Sundaram Textiles Pvt Ltd · TNCCI Member", team: "Team Vaigai"
};
export const MENTOR = {
  name: "SG", init: "SG", role: "Mentor · Team Vaigai",
  org: "Sundaram Textiles Pvt Ltd", id: "MN-118"
};

export const MODULES = [
  {
    id: 1, title: "Communication Skills", hours: "6 hrs", desc: "Speaking with clarity, listening, and writing that gets read.",
    mats: [
      { t: "Speaking with clarity", k: "video", src: "v1", len: "12 min" },
      { t: "Listening like a professional", k: "video", src: "v2", len: "9 min" },
      { t: "Workbook: Communication Skills", k: "doc", len: "18 pages" },
      { t: "Handout: 40 words that weaken a sentence", k: "doc", len: "4 pages" }
    ]
  },
  {
    id: 2, title: "Business Networking", hours: "5 hrs", desc: "Opening a conversation, following up, and building a contact list that works.",
    mats: [
      { t: "Building a first contact", k: "video", src: "v2", len: "11 min" },
      { t: "Workbook: Networking", k: "doc", len: "14 pages" },
      { t: "Template: Follow-up messages", k: "doc", len: "3 pages" }
    ]
  },
  {
    id: 3, title: "Decision Making", hours: "6 hrs", desc: "Frameworks for choosing under pressure, with real Chamber case studies.",
    mats: [
      { t: "Deciding with incomplete information", k: "video", src: "v3", len: "14 min" },
      { t: "Case study: A pricing call at a Madurai unit", k: "doc", len: "9 pages" },
      { t: "Workbook: Decision Making", k: "doc", len: "16 pages" }
    ]
  },
  {
    id: 4, title: "Presentation Skills", hours: "6 hrs", desc: "Structure, slides that carry weight, and standing up in front of a room.",
    mats: [
      { t: "Structure of a talk", k: "video", src: "v3", len: "13 min" },
      { t: "Workbook: Presentation Skills", k: "doc", len: "20 pages" }
    ]
  },
  {
    id: 5, title: "Workplace Etiquette & Email", hours: "4 hrs", desc: "Email that reads well, meeting behaviour, and working with seniors.",
    mats: [
      { t: "Email that gets a reply", k: "video", src: "v1", len: "10 min" },
      { t: "Handbook: Workplace etiquette", k: "doc", len: "12 pages" }
    ]
  },
  {
    id: 6, title: "Interview & Industry Readiness", hours: "8 hrs", desc: "Resume, mock interviews, and what member companies actually ask.",
    mats: [
      { t: "What interviewers listen for", k: "video", src: "v2", len: "15 min" },
      { t: "Workbook: Interview preparation", k: "doc", len: "22 pages" },
      { t: "Resume formats used by member companies", k: "doc", len: "6 pages" }
    ]
  }
];

export const QUIZ = {
  1: [{
    q: "A senior asks for a status update in a corridor. What is the strongest opening?",
    o: ["Start from what happened first, in order", "Give the current status in one line, then detail if asked", "Apologise for the delay before anything else", "Ask whether now is a good time to explain fully"], a: 1
  },
  {
    q: "Which sentence carries the most weight?",
    o: ["I think we could possibly try to finish by Friday", "It may perhaps be finished around Friday", "We will finish by Friday", "Friday is being looked at as a target"], a: 2
  },
  {
    q: "In active listening, the first thing you do after the other person stops is:",
    o: ["Give your own view", "Summarise what you heard in your words", "Ask an unrelated question", "Move to the next agenda item"], a: 1
  }],
  2: [{
    q: "You meet a member company owner at a Chamber event. The best first question is:",
    o: ["Do you have any vacancies?", "What does your unit make, and what is changing in it?", "Can I send you my resume?", "How much do you pay freshers?"], a: 1
  },
  {
    q: "A follow-up message works best when it is sent:",
    o: ["Within 24 to 48 hours, referring to what you discussed", "After two weeks, so you are not a nuisance", "Only if they said to contact them", "On a festival day with a greeting"], a: 0
  },
  {
    q: "A useful contact record should hold:",
    o: ["Name and phone number only", "Name, organisation, what they care about, and the next step", "Their photograph", "Their home address"], a: 1
  }],
  3: [{
    q: "Two options both look reasonable and the deadline is today. What do you do first?",
    o: ["Pick the cheaper one", "Name the one thing that would make either option wrong", "Ask for an extension", "Choose the one your senior prefers"], a: 1
  },
  {
    q: "A reversible decision deserves:",
    o: ["The same analysis as an irreversible one", "Faster action, since it can be corrected", "No decision at all", "An escalation to the mentor"], a: 1
  },
  {
    q: "Which is a sunk cost you should ignore?",
    o: ["The money already spent on the failed design", "The cost of the new design", "The delivery penalty next week", "Staff time needed from tomorrow"], a: 0
  }],
  4: [{
    q: "A 10-minute talk should carry:",
    o: ["One idea, supported three ways", "Five ideas, one slide each", "As much data as will fit", "A summary of everything you read"], a: 0
  },
  {
    q: "The strongest opening for a presentation is:",
    o: ["An apology for nervousness", "An agenda slide read aloud", "The single point you want remembered", "A long self-introduction"], a: 2
  },
  {
    q: "Slides work best when they:",
    o: ["Repeat your script so you can read them", "Carry one claim and its evidence", "Are fully animated", "Hold every number you gathered"], a: 1
  }],
  5: [{
    q: "A professional email subject line should:",
    o: ["Be left blank for short mails", "Name the subject and the action needed", "Say Urgent in capitals", "Contain your full name"], a: 1
  },
  {
    q: "You will be ten minutes late to a meeting. You:",
    o: ["Say nothing and slip in quietly", "Message the organiser before it starts", "Explain at length once you arrive", "Skip the meeting"], a: 1
  },
  {
    q: "Replying to all is appropriate when:",
    o: ["Everyone on the thread needs your answer", "You want to be seen responding", "You are thanking one person", "You disagree with someone"], a: 0
  }],
  6: [{
    q: "Tell me about yourself is best answered with:",
    o: ["Your full life story from school", "A 60-second arc: what you have done, what you are good at, what you want next", "Your family background", "Your marks in every semester"], a: 1
  },
  {
    q: "When you do not know the answer in an interview:",
    o: ["Guess confidently", "Say you do not know, then how you would find out", "Change the subject", "Stay silent"], a: 1
  },
  {
    q: "The best question to ask an interviewer is:",
    o: ["What is the salary?", "How many leaves do I get?", "What does someone who does well in this role do differently?", "When will you inform me?"], a: 2
  }]
};

export const SYLLABUS = {
  meta: { hours: "35 hours", sessions: "12 classroom sessions", pattern: "2 attempts per assessment · pass mark 60%", venue: "Chamber Building, Madurai · Saturdays & Sundays" },
  1: {
    sessions: 2, topics: ["Clarity and structure in speech", "Active listening", "Business writing and email basics", "Speaking to a small group", "Voice, pace and body language"],
    out: "Give a clear one-minute update to a senior, and write an email that gets a reply."
  },
  2: {
    sessions: 2, topics: ["Opening a conversation with a stranger", "The 40-word introduction", "Following up within 48 hours", "Building and maintaining a contact list", "Chamber events and how to use them"],
    out: "Start and then continue a professional relationship with a member company."
  },
  3: {
    sessions: 2, topics: ["Reversible and irreversible decisions", "Naming the fact that decides", "Cost, risk and sunk cost", "Group decisions and honest dissent", "Case studies from member units"],
    out: "Reach a defensible decision under a deadline and explain why you chose it."
  },
  4: {
    sessions: 2, topics: ["One idea, three supports", "Structuring a ten-minute talk", "Slides that carry weight", "Handling questions you did not expect", "Stage presence and nerves"],
    out: "Deliver a ten-minute presentation that leaves one clear message behind."
  },
  5: {
    sessions: 1, topics: ["Your first thirty days in a workplace", "Email discipline and reply times", "Meeting behaviour", "Working with seniors and peers", "Phone and messaging etiquette"],
    out: "Conduct yourself as an employee rather than as a student."
  },
  6: {
    sessions: 3, topics: ["A resume in one page", "The sixty-second arc", "Twelve questions member companies ask", "Mock interview with panel feedback", "Offer and salary conversations", "Industry visit debrief"],
    out: "Face a member-company interview panel and answer with evidence."
  }
};

export const SCHEDULE = [
  { d: "Sat", dt: "13 Sep", t: "9:30 AM – 12:30 PM", ttl: "Communication Skills — Session 3", room: "Hall A, Chamber Building", tr: "Ms. Anitha Rajan", st: "today" },
  { d: "Sun", dt: "14 Sep", t: "10:00 AM – 12:00 PM", ttl: "Mentor group review", room: "Room 204, Chamber Building", tr: "SG", st: "next" },
  { d: "Sat", dt: "20 Sep", t: "9:30 AM – 12:30 PM", ttl: "Business Networking — Session 1", room: "Hall A, Chamber Building", tr: "Mr. R. Venkatesh", st: "" },
  { d: "Sat", dt: "27 Sep", t: "9:30 AM – 1:00 PM", ttl: "Industry visit — Sundaram Textiles", room: "Meet at Chamber gate, 9:00 AM", tr: "Coordinator: Ms. Divya", st: "offsite" },
  { d: "Sat", dt: "04 Oct", t: "9:30 AM – 12:30 PM", ttl: "Decision Making — Session 1", room: "Hall B, Chamber Building", tr: "Mr. S. Balaji", st: "" }
];

export const TIMETABLE = [
  { d: "Mon", s: ["—", "—", "Self-paced LMS"] },
  { d: "Tue", s: ["—", "—", "Self-paced LMS"] },
  { d: "Wed", s: ["—", "Mentor call 7 PM", "—"] },
  { d: "Thu", s: ["—", "—", "Self-paced LMS"] },
  { d: "Fri", s: ["—", "—", "Assessment window"] },
  { d: "Sat", s: ["Classroom 9:30", "Workshop 11:00", "Practice 12:00"] },
  { d: "Sun", s: ["Group review 10:00", "—", "—"] }
];

export const TEAM = [
  { n: "Priya R", c: "Fatima College", r: "You", i: "PR", col: "#0E7A4E", p: 62 },
  { n: "Arun Kumar S", c: "Thiagarajar College", r: "Team lead", i: "AK", col: "#1B9AD6", p: 78 },
  { n: "Divya Bharathi", c: "Lady Doak College", r: "Member", i: "DB", col: "#C2186B", p: 55 },
  { n: "Mohammed Rafi", c: "American College", r: "Member", i: "MR", col: "#B4531B", p: 41 },
  { n: "Keerthana V", c: "Fatima College", r: "Member", i: "KV", col: "#6A4CB3", p: 70 },
  { n: "Vignesh P", c: "Madurai Kamaraj Univ.", r: "Member", i: "VP", col: "#0A5B39", p: 33 }
];

export const ANNOUNCE = [
  { t: "Industry visit on 27 September — consent form due", b: "Students joining the Sundaram Textiles visit must submit the signed consent form to the coordinator by 22 September. Report at the Chamber gate by 9:00 AM; the bus leaves at 9:15 AM sharp.", by: "Programme Office", w: "2 hours ago", tag: "Action needed", k: "w" },
  { t: "Module 2 assessment window opens Friday", b: "The Business Networking assessment will be open from Friday 6:00 PM to Sunday 9:00 PM. You get two attempts. Complete Module 1 first — Module 2 unlocks only after you pass it.", by: "LMS Team", w: "Yesterday", tag: "LMS", k: "b" },
  { t: "Certificate for Module 1 now generated on passing", b: "From this batch onward, your module certificate is issued automatically within 24 hours of passing the assessment and is available under Certificates.", by: "Programme Office", w: "3 days ago", tag: "Update", k: "g" },
  { t: "Hall change for 13 September session", b: "Saturday's Communication Skills session moves from Hall B to Hall A on the first floor. Attendance geofence is unchanged.", by: "Ms. Anitha Rajan", w: "4 days ago", tag: "Schedule", k: "n" }
];

export const NOTIFS = [
  { t: "Attendance marked", b: "Session on 06 Sep · Hall A · 9:34 AM", w: "2 days ago", k: "g", ic: "check" },
  { t: "New material added", b: "Handout: 40 words that weaken a sentence — Module 1", w: "3 days ago", k: "b", ic: "file" },
  { t: "Mentor posted in Team Vaigai", b: "SG: “Bring your resume drafts on Sunday.”", w: "4 days ago", k: "m", ic: "chat" },
  { t: "Assessment reminder", b: "Module 1 assessment closes Sunday 9:00 PM", w: "5 days ago", k: "w", ic: "bell" },
  { t: "Profile incomplete", b: "Add your resume to finish your profile", w: "1 week ago", k: "n", ic: "user" }
];

export let DISCUSS = [
  { n: "Arun Kumar S", i: "AK", col: "#1B9AD6", w: "10:12 AM", t: "For the Saturday session, are we presenting individually or as a team?", me: false },
  { n: "Ms. Anitha Rajan", i: "AR", col: "#0A5B39", w: "10:31 AM", t: "Individually — 3 minutes each. Structure matters more than slides. No slides needed for this one.", me: false },
  { n: "Priya R", i: "PR", col: "#0E7A4E", w: "10:44 AM", t: "Is the workbook exercise on page 12 part of the assessment?", me: true },
  { n: "Ms. Anitha Rajan", i: "AR", col: "#0A5B39", w: "11:02 AM", t: "Not directly, but the assessment assumes you have done it. Please finish it before Friday.", me: false }
];

export let GROUPCHAT = [
  { n: "SG", i: "SG", col: "#0A5B39", w: "Yesterday", t: "Team Vaigai — bring your resume drafts on Sunday. One page only. We will mark them together.", me: false },
  { n: "Divya Bharathi", i: "DB", col: "#C2186B", w: "Yesterday", t: "Sir, can we send it by email before, so you have time to read?", me: false },
  { n: "SG", i: "SG", col: "#0A5B39", w: "8:15 AM", t: "Yes, send to me by Saturday night. Printed copy still needed on Sunday.", me: false }
];

export const DOCS = {
  "Workbook: Communication Skills": [
    {
      h: "Why clarity beats vocabulary", p: ["In a working day nobody has time to decode a sentence twice. The professional who is understood the first time saves everyone else's attention, and that is what gets them asked back into the room.", "This module is built around one habit: say the conclusion first, then support it. Most students do the opposite — they narrate the journey and leave the listener to guess where it is going."],
      l: ["State the outcome in one sentence.", "Give at most three supports.", "Stop. Let the other person ask."]
    },
    { h: "Exercise 1 — The one-line status", p: ["Write a single sentence that tells your mentor where your assignment stands. No apology, no history. Then write the three-sentence version you would give if asked for detail."] },
    { h: "Exercise 2 — Cutting weak words", p: ["Take any message you sent this week. Delete every instance of just, actually, basically, kind of, I think, and maybe. Read what is left. If the meaning survived, the words were doing nothing."] }
  ],
  "Handout: 40 words that weaken a sentence": [
    {
      h: "Hedges to remove", p: ["These words dilute a claim without adding information. Remove them unless the uncertainty is real and material."],
      l: ["just, actually, basically, quite, rather, somewhat", "I think, I feel, I believe, in my opinion", "maybe, perhaps, possibly, hopefully", "very, really, extremely, totally"]
    },
    { h: "When a hedge is honest", p: ["If you genuinely do not know, say so precisely: “I have not verified the second figure yet.” That is not a hedge. It is information."] }
  ],
  "Workbook: Networking": [
    {
      h: "A first conversation has three parts", p: ["Networking is not collecting numbers. It is starting something you can continue. Every good first conversation carries a question about their work, something specific about yours, and one agreed next step."],
      l: ["Ask what they make and what is changing in it.", "Say in one line what you are learning and why.", "Agree the next step before you part."]
    },
    { h: "Exercise — The 40-word introduction", p: ["Write your own introduction in 40 words. Name your college, what you are building skill in, and one thing you want to learn from a member company. Read it aloud until it sounds like speech and not a paragraph."] }
  ],
  "Template: Follow-up messages": [
    { h: "Within 48 hours", p: ["Respected Sir / Madam,", "We spoke at the Chamber event on ____ about ____. Thank you for the time. You mentioned ____ — I have since read about it and had one question: ____.", "I am part of the SHARP programme at the Tamil Nadu Chamber. If it is convenient, may I visit your unit for an hour with my mentor's introduction?"] },
    { h: "Rules", p: ["One question, not five. Name where you met. Never attach a resume to a first message unless they asked for it."] }
  ],
  "Case study: A pricing call at a Madurai unit": [
    { h: "The situation", p: ["A textile unit with 42 workers has been asked by a long-standing buyer for a 9% price reduction on a repeat order. The order is 30% of the unit's monthly volume. Material cost has risen 4% since the last contract.", "The owner has three days to answer."] },
    {
      h: "What you must decide", p: ["Work in your group. Name the information you would need before answering, the option you would recommend, and what would make your recommendation wrong."],
      l: ["Accept, and cut cost elsewhere", "Refuse, and risk the buyer", "Counter with a smaller reduction tied to a longer commitment", "Split the order at two prices"]
    },
    { h: "Discussion note", p: ["There is no single correct answer. The mark is for naming the one fact that would change your choice."] }
  ],
  "Workbook: Decision Making": [
    { h: "Reversible or not", p: ["Before analysing anything, ask whether the decision can be undone. Reversible decisions deserve speed; irreversible ones deserve the meeting. Students routinely spend their best thinking on choices that could have been corrected in an afternoon."] },
    { h: "The one-fact test", p: ["For any close call, write the single fact that would flip your decision. Then go and find that fact. This converts an argument into a task."] }
  ],
  "Workbook: Presentation Skills": [
    { h: "One idea, three supports", p: ["A ten-minute talk carries one idea. Everything else is support: a number, an example, a demonstration. If you cannot name your one idea in a sentence, the audience will not find it either."] },
    { h: "Standing up", p: ["Plant your feet, look at one person for one full sentence, then move to another. Nervousness shows in the feet and the hands long before it shows in the voice."] }
  ],
  "Handbook: Workplace etiquette": [
    { h: "The first month", p: ["Arrive earlier than required, learn the names of the people who are not senior to you, and never be the person who has to be reminded twice about the same thing."] },
    { h: "Email", p: ["Subject lines name the subject and the action. Reply within a working day even if the answer is “I will check and revert by Thursday.” Reply-all only when everyone needs the answer."] }
  ],
  "Workbook: Interview preparation": [
    { h: "The 60-second arc", p: ["What you have done, what you are good at, what you want next. Practise it until it is 60 seconds and sounds spoken. Every interview begins here and many are decided here."] },
    {
      h: "Twelve questions member companies ask", p: ["Prepare an answer, with an example, for each of these."],
      l: ["Tell me about yourself.", "Why should we take a fresher?", "A time you were wrong.", "A time you convinced someone.", "What do you know about our business?", "Where do you want to be in three years?"]
    }
  ],
  "Resume formats used by member companies": [
    { h: "One page, three blocks", p: ["Education with marks, then skills with evidence, then anything you have actually done — a project, a shop-floor visit, a college event you ran. Member companies read the third block first."] },
    { h: "What to leave out", p: ["Objective statements, declarations, father's occupation, marital status, and photographs unless asked. Nothing here helps them decide."] }
  ]
};
