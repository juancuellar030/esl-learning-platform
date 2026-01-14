// Grammar Bank
const grammarBank = [
    {
        id: 'grammar_01',
        rule: 'Present Simple',
        category: 'tenses',
        level: 'beginner',
        explanation: 'We use the Present Simple to talk about habits, routines, and general facts. For most verbs, add -s or -es for he/she/it.',
        examples: [
            'I eat breakfast every day.',
            'She works at a school.',
            'They play soccer on Saturdays.',
            'He doesn\'t like coffee.',
            'Do you speak English?'
        ],
        commonMistakes: [
            'Incorrect: He go to school. \u2192 Correct: He goes to school.',
            'Incorrect: She don\'t like pizza. \u2192 Correct: She doesn\'t like pizza.',
            'Incorrect: Do he play tennis? \u2192 Correct: Does he play tennis?'
        ],
        exercises: [
            {type: 'fill-blank', sentence: 'She ___ (go) to work every day.', answer: 'goes'},
            {type: 'fill-blank', sentence: 'They ___ (play) soccer on weekends.', answer: 'play'},
            {type: 'error-correction', sentence: 'He don\'t like vegetables.', answer: 'He doesn\'t like vegetables.'}
        ]
    },
    {
        id: 'grammar_02',
        rule: 'Articles: A, An, The',
        category: 'articles',
        level: 'beginner',
        explanation: 'Use "a" before consonant sounds, "an" before vowel sounds. Use "the" for specific things.',
        examples: [
            'I have a cat. (any cat)',
            'She is an engineer. (vowel sound)',
            'The sun is bright. (specific sun)',
            'I saw a dog. The dog was big. (first mention, then specific)'
        ],
        commonMistakes: [
            'Incorrect: I have a apple. \u2192 Correct: I have an apple.',
            'Incorrect: She is teacher. \u2192 Correct: She is a teacher.',
            'Incorrect: I went to a school. \u2192 Correct: I went to school. (no article for general places)'
        ],
        exercises: [
            {type: 'fill-blank', sentence: 'I have ___ umbrella.', answer: 'an'},
            {type: 'fill-blank', sentence: 'She is ___ doctor.', answer: 'a'},
            {type: 'fill-blank', sentence: '___ moon is beautiful tonight.', answer: 'The'}
        ]
    },
    {
        id: 'grammar_03',
        rule: 'Present Continuous',
        category: 'tenses',
        level: 'intermediate',
        explanation: 'Use Present Continuous for actions happening now. Form: am/is/are + verb-ing',
        examples: [
            'I am studying English now.',
            'She is watching TV.',
            'They are playing in the park.',
            'He is not sleeping.',
            'Are you listening to me?'
        ],
        commonMistakes: [
            'Incorrect: I am go to school. \u2192 Correct: I am going to school.',
            'Incorrect: She working now. \u2192 Correct: She is working now.',
            'Incorrect: They are play soccer. \u2192 Correct: They are playing soccer.'
        ],
        exercises: [
            {type: 'fill-blank', sentence: 'She ___ (read) a book right now.', answer: 'is reading'},
            {type: 'fill-blank', sentence: 'We ___ (watch) a movie.', answer: 'are watching'}
        ]
    },
    {
        id: 'grammar_04',
        rule: 'Prepositions of Time',
        category: 'prepositions',
        level: 'intermediate',
        explanation: 'Use IN for months/years, ON for days/dates, AT for specific times.',
        examples: [
            'I was born in 2010. (year)',
            'My birthday is in May. (month)',
            'The party is on Saturday. (day)',
            'Class starts at 9 AM. (time)',
            'We go on holiday in summer.'
        ],
        commonMistakes: [
            'Incorrect: I wake up on 7 AM. \u2192 Correct: I wake up at 7 AM.',
            'Incorrect: My birthday is at May. \u2192 Correct: My birthday is in May.',
            'Incorrect: See you in Monday. \u2192 Correct: See you on Monday.'
        ],
        exercises: [
            {type: 'fill-blank', sentence: 'I have class ___ 3 PM.', answer: 'at'},
            {type: 'fill-blank', sentence: 'Her birthday is ___ July.', answer: 'in'},
            {type: 'fill-blank', sentence: 'We meet ___ Fridays.', answer: 'on'}
        ]
    },
    {
        id: 'grammar_05',
        rule: 'Modal Verbs: Can/Could',
        category: 'modals',
        level: 'intermediate',
        explanation: 'Use CAN for ability and permission. Use COULD for past ability or polite requests.',
        examples: [
            'I can swim very well. (ability)',
            'Can I use your phone? (permission)',
            'She could speak French when she was young. (past ability)',
            'Could you help me, please? (polite request)'
        ],
        commonMistakes: [
            'Incorrect: I can to swim. \u2192 Correct: I can swim.',
            'Incorrect: He cans play guitar. \u2192 Correct: He can play guitar.',
            'Incorrect: She could swam last year. \u2192 Correct: She could swim last year.'
        ],
        exercises: [
            {type: 'fill-blank', sentence: 'I ___ speak three languages.', answer: 'can'},
            {type: 'fill-blank', sentence: '___ you open the window?', answer: 'Could'}
        ]
    },
    {
        id: 'grammar_06',
        rule: 'Imperatives (Commands)',
        category: 'modals',
        level: 'beginner',
        explanation: 'Use the verb alone to give an order or instruction. Use "Don\'t" for negative orders.',
        examples: [
            'Sit down.',
            'Open your book.',
            'Listen to me.',
            'Don\'t run in class.',
            'Be careful.'
        ],
        commonMistakes: [
            'Incorrect: You sit down. \u2192 Correct: Sit down.',
            'Incorrect: Not run. \u2192 Correct: Don\'t run.',
            'Incorrect: To open the door. \u2192 Correct: Open the door.'
        ],
        exercises: [
            {type: 'fill-blank', sentence: '___ (open) the window, please.', answer: 'Open'},
            {type: 'fill-blank', sentence: '___ (not/talk) loudly.', answer: 'Don\'t talk'},
            {type: 'error-correction', sentence: 'You eat your lunch.', answer: 'Eat your lunch.'}
        ]
    },
    {
        id: 'grammar_07',
        rule: 'Suggestions with "Let\'s"',
        category: 'modals',
        level: 'beginner',
        explanation: 'Use "Let\'s" (Let us) + verb to make a suggestion for everyone to do together.',
        examples: [
            'Let\'s go to the park.',
            'Let\'s play a game.',
            'Let\'s paint a picture.',
            'Let\'s stop now.'
        ],
        commonMistakes: [
            'Incorrect: Let\'s to go. \u2192 Correct: Let\'s go.',
            'Incorrect: Let\'s going. \u2192 Correct: Let\'s go.',
            'Incorrect: Lets play. (missing apostrophe) \u2192 Correct: Let\'s play.'
        ],
        exercises: [
            {type: 'fill-blank', sentence: 'It\'s sunny. ___ go outside.', answer: 'Let\'s'},
            {type: 'error-correction', sentence: 'Let\'s playing soccer.', answer: 'Let\'s play soccer.'}
        ]
    },
    {
        id: 'grammar_08',
        rule: 'May vs. Might',
        category: 'modals',
        level: 'intermediate',
        explanation: 'We use May and Might to talk about possibility. May is often used for things that are more likely to happen, while Might is for things that are less likely. However, in modern English, they are often interchangeable for possibility.',
        image: 'assets/images/grammar/may-might.png',
        examples: [
            'It may rain today. (It is cloudy, 50% chance)',
            'I might go to the party. (I am not sure, 30% chance)',
            'May I come in? (Formal permission)',
            'You might want to try this. (Polite suggestion)'
        ],
        commonMistakes: [
            'Incorrect: It maybe rain. \u2192 Correct: It may rain.',
            'Incorrect: I may to go. \u2192 Correct: I may go.',
            'Incorrect: Might I go to the bathroom? (Too formal/archaic) \u2192 Correct: May I go to the bathroom?'
        ],
        exercises: [
            {type: 'fill-blank', sentence: 'Look at those clouds! It ___ rain.', answer: 'may'},
            {type: 'fill-blank', sentence: 'I ___ join you later, but I am busy.', answer: 'might'}
        ]
    },
    {
        id: 'grammar_09',
        rule: 'Question Words (Wh- Questions)',
        category: 'questions',
        level: 'beginner',
        explanation: 'We use specific question words to get different types of information: Who (Person), What (Thing/Action), Where (Place), When (Time), Why (Reason), Which (Choice), How (Manner), What time (Specific Time).',
        examples: [
            'Who is your teacher? (Person)',
            'What is that? (Thing)',
            'Where do you live? (Place)',
            'When is your birthday? (Time)',
            'Why are you running? (Reason)',
            'Which color do you prefer? (Choice)',
            'How do you go to school? (Manner)',
            'What time is it? (Specific Time)'
        ],
        commonMistakes: [
            'Incorrect: When is your house? (Meaning Where) \u2192 Correct: Where is your house?',
            'Incorrect: Why you cry? \u2192 Correct: Why are you crying?'
        ],
        exercises: [
            {type: 'fill-blank', sentence: '___ is your name?', answer: 'What'},
            {type: 'fill-blank', sentence: '___ do you live?', answer: 'Where'},
            {type: 'fill-blank', sentence: '___ is that girl?', answer: 'Who'}
        ]
    },
    {
        id: 'grammar_10',
        rule: 'Cause and Effect: Why and Because',
        category: 'questions',
        level: 'beginner',
        explanation: 'Questions starting with "Why" ask for a reason. We answer these questions with "Because".',
        examples: [
            'Question: Why are you running?',
            'Answer: Because school starts in ten minutes.',
            'Question: Why are you happy?',
            'Answer: Because it is my birthday.'
        ],
        commonMistakes: [
            'Incorrect: Why are you late? Traffic. \u2192 Correct: Because of traffic.',
            'Incorrect: Why do you eat? Yes, I do. \u2192 Correct: Because I am hungry.'
        ],
        exercises: [
            {type: 'fill-blank', sentence: '___ are you sad?', answer: 'Why'},
            {type: 'fill-blank', sentence: 'Why are you smiling? ___ I am happy.', answer: 'Because'}
        ]
    },
    {
        id: 'grammar_11',
        rule: 'Months and Time',
        category: 'prepositions',
        level: 'beginner',
        explanation: 'The year has twelve months. We use "in" for months (in January). We use "before" and "after" to talk about the order of months.',
        examples: [
            'January is the first month.',
            'February comes after January.',
            'April is before May.',
            'My birthday is in August.'
        ],
        commonMistakes: [
            'Incorrect: On January. \u2192 Correct: In January.',
            'Incorrect: March is after April. \u2192 Correct: March is before April.'
        ],
        exercises: [
            {type: 'sentence-unjumble', sentence: 'January is the first month', words: ['January', 'is', 'the', 'first', 'month']},
            {type: 'sentence-unjumble', sentence: 'February comes after January', words: ['February', 'comes', 'after', 'January']},
            {type: 'fill-blank', sentence: 'December is ___ (after/before) November.', answer: 'after'}
        ]
    },
    {
        id: 'grammar_12',
        rule: 'Transport and Journeys',
        category: 'prepositions',
        level: 'intermediate',
        explanation: 'We use "by" for modes of transport (by car, by train). We use "on" for public transport platforms and "at" for stations.',
        examples: [
            'I go to school by bicycle.',
            'The train is at the railway station.',
            'Wait for the train on the platform.',
            'There is a lot of traffic on the motorway.'
        ],
        commonMistakes: [
            'Incorrect: I go in car. \u2192 Correct: I go by car.',
            'Incorrect: Wait in the platform. \u2192 Correct: Wait on the platform.'
        ],
        exercises: [
            {type: 'sentence-unjumble', sentence: 'I go to school by car', words: ['I', 'go', 'to', 'school', 'by', 'car']},
            {type: 'sentence-unjumble', sentence: 'The train is at the station', words: ['The', 'train', 'is', 'at', 'the', 'station']},
            {type: 'fill-blank', sentence: 'We are going ___ a journey.', answer: 'on'}
        ]
    },
    {
        id: 'grammar_13',
        rule: 'Indefinite Pronouns',
        category: 'pronouns',
        level: 'beginner',
        explanation: 'Indefinite pronouns are used to talk about people, places, or things without saying exactly who, where, or what they are. Common prefixes include every-, some-, any-, and no-.',
        examples: [
            'Everyone is here.',
            'I want something to eat.',
            'Is there anyone in the room?',
            'I have nothing to say.'
        ],
        commonMistakes: [
            'Incorrect: I don\'t have nothing. \u2192 Correct: I have nothing. (or I don\'t have anything)',
            'Incorrect: Someone are calling. \u2192 Correct: Someone is calling. (Indefinite pronouns are singular)'
        ],
        exercises: [
            {type: 'fill-blank', sentence: 'I am hungry. I want ___ to eat.', answer: 'something'},
            {type: 'fill-blank', sentence: '___ is knocking at the door.', answer: 'Someone'},
            {type: 'fill-blank', sentence: 'Is there ___ in the garden?', answer: 'anyone'}
        ]
    },
    {
        id: 'grammar_14',
        rule: 'Telling the Time',
        category: 'time',
        level: 'beginner',
        explanation: 'In English, we use "past" for the first 30 minutes and "to" for the last 30 minutes. We use "o\'clock" for exact hours.',
        examples: [
            'It\'s five past two. (2:05)',
            'It\'s quarter past two. (2:15)',
            'It\'s half past two. (2:30)',
            'It\'s twenty to three. (2:40)'
        ],
        commonMistakes: [
            'Incorrect: It\'s two and half. \u2192 Correct: It\'s half past two.',
            'Incorrect: It\'s fifteen past two. \u2192 Correct: It\'s quarter past two.'
        ],
        exercises: [
            {type: 'fill-blank', sentence: '2:30 is ___ past two.', answer: 'half'},
            {type: 'fill-blank', sentence: '2:45 is ___ to three.', answer: 'quarter'},
            {type: 'fill-blank', sentence: '2:00 is two ___.', answer: 'o\'clock'}
        ]
    }
];

// Make data available globally
window.grammarBank = grammarBank;
