import type { TaskDraft } from "../../src/domain/routine";

type TestLanguage = "en" | "hi" | "hinglish";
type RoutineCase = {
  name: string;
  text: Record<TestLanguage, string>;
  expected: TaskDraft[];
  reviewable: boolean;
};

const exercise: TaskDraft = {
  kind: "outdoor_exercise",
  time: "07:00",
  duration: 30,
  fixed: false,
  travel: "unspecified",
  required: false,
  earliestStart: null,
  latestEnd: null,
};
const pickup: TaskDraft = {
  ...exercise,
  kind: "school_pickup",
  time: "15:00",
  duration: 25,
  fixed: true,
  travel: "car",
  required: true,
};

const examples: RoutineCase[] = [
  {
    name: "explicit morning with duration",
    text: {
      en: "Walk outdoors at 7 AM for 30 minutes.",
      hi: "सुबह ७ बजे ३० मिनट बाहर टहलना है।",
      hinglish: "Subah 7 baje 30 minute outdoor walk karni hai.",
    },
    expected: [exercise],
    reviewable: true,
  },
  {
    name: "bare hour needs AM or PM",
    text: {
      en: "Outdoor walk at seven for 30 minutes.",
      hi: "७ बजे ३० मिनट बाहर टहलना है।",
      hinglish: "7 baje 30 minute bahar walk.",
    },
    expected: [{ ...exercise, time: null }],
    reviewable: false,
  },
  {
    name: "fixed car pickup",
    text: {
      en: "Pick up from school by car at 3 PM, fixed, 25 minutes.",
      hi: "दोपहर ३ बजे गाड़ी से स्कूल से लेने जाना है। समय तय है और २५ मिनट लगेंगे।",
      hinglish: "Dopahar 3 baje car se school pickup, fixed time, 25 min.",
    },
    expected: [pickup],
    reviewable: true,
  },
  {
    name: "two rescheduling bounds",
    text: {
      en: "Outdoor walk at 7 AM for 30 minutes. It can move to between 10:15 and 11:45 AM.",
      hi: "सुबह ७ बजे ३० मिनट बाहर टहलना है। समय बदलना पड़े तो सुबह १०:१५ से ११:४५ के बीच कर सकते हैं।",
      hinglish:
        "Subah 7 baje 30 min outdoor walk. Zarurat pade to 10:15 AM se 11:45 AM ke beech kar sakte hain.",
    },
    expected: [{ ...exercise, earliestStart: "10:15", latestEnd: "11:45" }],
    reviewable: true,
  },
  {
    name: "finish deadline only",
    text: {
      en: "30-minute walk outside at 7 AM. If moved, it must finish by 10 AM.",
      hi: "सुबह ७ बजे ३० मिनट बाहर टहलना है। समय बदले तो सुबह १० बजे तक पूरा करना होगा।",
      hinglish:
        "Subah 7 baje 30 min outside walk. Shift ho to 10 AM tak finish karni hai.",
    },
    expected: [{ ...exercise, latestEnd: "10:00" }],
    reviewable: true,
  },
  {
    name: "essential errand can move",
    text: {
      en: "At 9 AM go out to buy medicine for 20 minutes. It must happen, but the time is flexible.",
      hi: "सुबह ९ बजे दवा लेने बाहर जाना है, २० मिनट लगेंगे। जाना ज़रूरी है, समय बदल सकते हैं।",
      hinglish:
        "Subah 9 baje 20 minute bahar dawai lene jana zaroori hai, timing flexible hai.",
    },
    expected: [
      {
        ...exercise,
        kind: "outdoor_errand",
        time: "09:00",
        duration: 20,
        required: true,
      },
    ],
    reviewable: true,
  },
  {
    name: "evening cleaning without a duration",
    text: {
      en: "Dry sweep the floor at 7:30 PM.",
      hi: "शाम ७:३० बजे सूखी झाड़ू लगानी है।",
      hinglish: "Shaam 7:30 baje dry jhaadu lagani hai.",
    },
    expected: [
      { ...exercise, kind: "dry_sweeping", time: "19:30", duration: null },
    ],
    reviewable: false,
  },
  {
    name: "incense",
    text: {
      en: "Burn incense at 7 PM for 10 minutes.",
      hi: "शाम ७ बजे १० मिनट अगरबत्ती जलानी है।",
      hinglish: "Shaam 7 baje 10 min agarbatti jalani hai.",
    },
    expected: [
      { ...exercise, kind: "burn_incense", time: "19:00", duration: 10 },
    ],
    reviewable: true,
  },
  {
    name: "canceled activity is excluded",
    text: {
      en: "No morning walk. Pick up from school by car at 3 PM, fixed, 25 minutes.",
      hi: "सुबह नहीं टहलना है। दोपहर ३ बजे गाड़ी से स्कूल से लेने जाना है, समय तय है, २५ मिनट लगेंगे।",
      hinglish:
        "Morning walk cancel hai. Dopahar 3 baje car se school pickup fixed hai, 25 min.",
    },
    expected: [pickup],
    reviewable: true,
  },
  {
    name: "multiple activities in the original order",
    text: {
      en: "30-minute walk outdoors at 7 AM. Fixed meeting at 9 AM for 20 minutes.",
      hi: "सुबह ७ बजे ३० मिनट बाहर टहलना है। सुबह ९ बजे तय बैठक है, २० मिनट की।",
      hinglish: "Subah 7 baje 30 min outdoor walk. 9 AM fixed meeting, 20 min.",
    },
    expected: [
      exercise,
      {
        ...exercise,
        kind: "other",
        time: "09:00",
        duration: 20,
        fixed: true,
        required: true,
      },
    ],
    reviewable: true,
  },
];

const languages: TestLanguage[] = ["en", "hi", "hinglish"];
export const multilingualRoutines = languages.flatMap((language) =>
  examples.map(({ name, text, expected, reviewable }) => ({
    language,
    name,
    text: text[language],
    expected,
    reviewable,
  })),
);
