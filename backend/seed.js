const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const User = require('./models/User');
const Debate = require('./models/Debate');
const Argument = require('./models/Argument');
const LiveChat = require('./models/LiveChat');

dotenv.config();

const CATEGORIES = ['Technology', 'Education', 'Politics', 'Science', 'Environment'];
const ARGUMENT_TYPES = ['argument', 'rebuttal', 'question'];

const USER_NAMES = [
  'John Carter',
  'Alice Morgan',
  'David Lee',
  'Emma Wilson',
  'Noah Brown',
  'Sophia Taylor',
  'Liam Anderson',
  'Olivia Thomas',
  'Mason White',
  'Ava Martin',
  'Lucas Jackson',
  'Isabella Harris',
  'Ethan Clark',
  'Mia Lewis',
  'James Walker'
];

const TITLE_POOL = {
  Technology: [
    'AI Regulation: Innovation vs Control',
    'Should Social Media Be Age Restricted?',
    'Open Source vs Proprietary Software',
    'Will Automation Replace Most Jobs?',
    'Is Remote Work Better Long Term?',
    'Facial Recognition in Public Spaces'
  ],
  Education: [
    'Online Classes vs Offline Classes',
    'Should Homework Be Banned?',
    'Uniforms: Equality or Restriction?',
    'Grades vs Skill-Based Evaluation',
    'Is College Still Worth It?',
    'Should Coding Be Mandatory in School?'
  ],
  Politics: [
    'Voting Should Be Mandatory',
    'Should Political Campaign Funding Be Capped?',
    'Freedom of Speech vs Hate Speech Laws',
    'Coalition Governments vs Majority Governments',
    'Should Youth Voting Age Be Lowered?',
    'National Security vs Privacy Rights'
  ],
  Science: [
    'Space Exploration vs Ocean Exploration',
    'Should Gene Editing Be Allowed?',
    'Animal Testing in Medical Research',
    'Is Nuclear Energy the Future?',
    'Can Science and Ethics Always Align?',
    'Should We Colonize Mars?'
  ],
  Environment: [
    'Climate Action: Individual vs Government Responsibility',
    'Should Single-Use Plastic Be Fully Banned?',
    'Economic Growth vs Environmental Protection',
    'Electric Cars vs Public Transport',
    'Should Carbon Tax Be Mandatory?',
    'Renewable Energy Can Fully Replace Fossil Fuels'
  ]
};

const PRO_LINES = {
  argument: [
    'This approach improves long-term outcomes and scalability.',
    'Data from recent studies supports stronger adoption of this model.',
    'The pro side creates measurable benefits for students and society.',
    'Efficiency and accessibility both improve under this proposal.'
  ],
  rebuttal: [
    'That concern is valid, but it ignores implementation safeguards.',
    'The downside mentioned is temporary, while benefits are sustained.',
    'Your example is an edge case, not the general trend.',
    'Practical evidence shows the opposite effect in real deployments.'
  ],
  question: [
    'How would your model handle fairness at scale?',
    'Can you show evidence that your approach is cost-effective?',
    'What is your plan for implementation in under-resourced regions?',
    'How do you mitigate the long-term risk you identified?'
  ]
};

const CON_LINES = {
  argument: [
    'This creates unintended risks that outweigh short-term benefits.',
    'The model is difficult to apply fairly across diverse communities.',
    'Costs and social impact make this approach unsustainable.',
    'Real-world constraints reduce the effectiveness of this proposal.'
  ],
  rebuttal: [
    'Your claim depends on ideal conditions that rarely exist.',
    'Those statistics are selective and ignore contradictory findings.',
    'The suggested safeguards are expensive and difficult to enforce.',
    'Even if benefits exist, the trade-offs remain too high.'
  ],
  question: [
    'What happens when this policy fails in low-resource settings?',
    'How do you address ethical issues in your implementation?',
    'Can your side guarantee equal outcomes for all groups?',
    'What is the fallback plan if adoption rates remain low?'
  ]
};

const AUDIENCE_CHAT_LINES = [
  'Good point!',
  'I agree with Pro on that one.',
  'I think Con has a stronger argument so far.',
  'Can someone explain that with an example?',
  'Interesting debate!',
  'That rebuttal was sharp.',
  'I want more details about implementation.',
  'This is getting intense 👀',
  'Audience poll would be fun here.',
  'Both sides are making valid points.'
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const pickOne = (items) => items[randomInt(0, items.length - 1)];

const pickDistinctPair = (items) => {
  const first = pickOne(items);
  let second = pickOne(items);

  while (second._id.toString() === first._id.toString()) {
    second = pickOne(items);
  }

  return [first, second];
};

const getDebateTimeline = () => {
  const now = Date.now();
  const status = pickOne(['live', 'upcoming', 'completed']);
  const durationMinutes = randomInt(30, 120);

  if (status === 'upcoming') {
    const startsInMinutes = randomInt(15, 72 * 60);
    const startTime = new Date(now + startsInMinutes * 60 * 1000);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    return { status, startTime, endTime, scheduledTime: startTime };
  }

  if (status === 'completed') {
    const endedMinutesAgo = randomInt(10, 72 * 60);
    const endTime = new Date(now - endedMinutesAgo * 60 * 1000);
    const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);
    return { status, startTime, endTime, scheduledTime: startTime };
  }

  const startedMinutesAgo = randomInt(5, 45);
  const startTime = new Date(now - startedMinutesAgo * 60 * 1000);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  return { status, startTime, endTime, scheduledTime: startTime };
};

const clearDatabase = async () => {
  await Promise.all([
    LiveChat.deleteMany({}),
    Argument.deleteMany({}),
    Debate.deleteMany({}),
    User.deleteMany({})
  ]);
};

const buildUsers = async () => {
  const passwordHash = await bcrypt.hash('123456', 10);

  return USER_NAMES.map((fullName, index) => {
    const [firstName, ...rest] = fullName.split(' ');
    const lastName = rest.join(' ');
    const role = index < 10 ? 'student' : index < 13 ? 'moderator' : 'other';

    return {
      name: fullName,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@test.com`,
      password: passwordHash,
      role,
      points: randomInt(0, 350),
      profileImage: `https://i.pravatar.cc/150?img=${index + 1}`,
      avatarUrl: `https://i.pravatar.cc/150?img=${index + 1}`
    };
  });
};

const createDebates = async (users) => {
  const moderators = users.filter((user) => user.role === 'moderator');
  const debates = [];

  for (const category of CATEGORIES) {
    const categoryDebateCount = randomInt(3, 6);

    for (let index = 0; index < categoryDebateCount; index += 1) {
      const [proUser, conUser] = pickDistinctPair(users);
      const createdBy = pickOne(moderators.length ? moderators : users);
      const timeline = getDebateTimeline();
      const title = pickOne(TITLE_POOL[category]);

      const debate = await Debate.create({
        title,
        topic: title,
        description: `Generated mock debate on ${category}. Discussing nuanced arguments from both perspectives.`,
        category,
        status: timeline.status,
        startTime: timeline.startTime,
        endTime: timeline.endTime,
        scheduledTime: timeline.scheduledTime,
        createdBy: createdBy._id,
        proUser: proUser._id,
        conUser: conUser._id,
        participants: {
          proUser: proUser._id,
          conUser: conUser._id
        },
        participantLabels: {
          proLabel: proUser.name,
          conLabel: conUser.name
        },
        watchersCount: randomInt(4, 40),
        proVotes: randomInt(0, 35),
        conVotes: randomInt(0, 35)
      });

      debates.push({
        doc: debate,
        proUser,
        conUser
      });
    }
  }

  return debates;
};

const createArgumentsForDebate = async (debateEntry) => {
  const argumentCount = randomInt(8, 20);
  const baseTime = new Date(debateEntry.doc.startTime).getTime();

  const batch = [];

  for (let index = 0; index < argumentCount; index += 1) {
    const isProTurn = index % 2 === 0;
    const side = isProTurn ? 'pro' : 'con';
    const user = isProTurn ? debateEntry.proUser : debateEntry.conUser;
    const type = pickOne(ARGUMENT_TYPES);
    const linesBySide = side === 'pro' ? PRO_LINES : CON_LINES;
    const content = pickOne(linesBySide[type]);
    const createdAt = new Date(baseTime + (index + 1) * randomInt(60, 180) * 1000);

    batch.push({
      debateId: debateEntry.doc._id,
      userId: user._id,
      side,
      type,
      content,
      createdAt,
      updatedAt: createdAt
    });
  }

  await Argument.insertMany(batch);
  return batch.length;
};

const createAudienceChatForDebate = async (debateEntry, users) => {
  const chatCount = randomInt(10, 25);
  const audiencePool = users.filter(
    (user) => user._id.toString() !== debateEntry.proUser._id.toString() && user._id.toString() !== debateEntry.conUser._id.toString()
  );
  const finalPool = audiencePool.length ? audiencePool : users;

  const baseTime = new Date(debateEntry.doc.startTime).getTime();
  const batch = [];

  for (let index = 0; index < chatCount; index += 1) {
    const sender = pickOne(finalPool);
    const createdAt = new Date(baseTime + (index + 1) * randomInt(30, 140) * 1000);

    batch.push({
      debateId: debateEntry.doc._id,
      userId: sender._id,
      role: 'audience',
      message: pickOne(AUDIENCE_CHAT_LINES),
      createdAt,
      updatedAt: createdAt
    });
  }

  await LiveChat.insertMany(batch);
  return batch.length;
};

const run = async () => {
  try {
    await connectDB();

    await clearDatabase();
    console.log('✅ Existing data deleted');

    const users = await User.insertMany(await buildUsers());
    console.log('✅ Users inserted:', users.length, '(10 students, 3 moderators, 2 others)');

    const debates = await createDebates(users);
    console.log('✅ Debates inserted:', debates.length, '(3–6 per category)');

    let totalArguments = 0;
    let totalLiveChats = 0;

    for (const debateEntry of debates) {
      totalArguments += await createArgumentsForDebate(debateEntry);
      totalLiveChats += await createAudienceChatForDebate(debateEntry, users);
    }

    console.log('✅ Pro/Con arguments inserted:', totalArguments);
    console.log('✅ Audience live chats inserted:', totalLiveChats);
    console.log('🎉 Mock data inserted successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

run();