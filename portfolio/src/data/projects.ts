export type Feature = { title: string; desc: string };
export type Metric = { value: string; count?: number; label: string };

export type Project = {
  slug: 'abhimate' | 'aurago' | 'discova' | 'abhinova';
  name: string;
  category: string;
  tagline: string;
  short: string;
  /** 'paused' = hosted demo offline; the code is still public and runs locally */
  status: 'live' | 'android' | 'soon' | 'paused';
  statusLabel: string;
  /** brand color on dark ground, and a darker one that passes contrast on light ground */
  color: string;
  colorLight: string;
  color2: string;
  seo: { title: string; description: string; og: string };
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  overviewTitle: string;
  overview: string[];
  featuresTitle: string;
  featuresLead?: string;
  features: Feature[];
  highlights?: Feature[];
  stack: string[];
  metrics: Metric[];
  runLocally?: { comment?: string; cmd?: string }[];
  cta: { title: string; text: string };
  next: Project['slug'];
};

export const projects: Project[] = [
  {
    slug: 'abhimate',
    name: 'AbhiMate',
    category: 'AI QA platform',
    tagline: 'Describe a feature. Get a tested suite.',
    short: 'Plain-English feature in, runnable BDD suite out. 11 agents across Selenium and Playwright.',
    status: 'paused',
    statusLabel: 'Runs locally',
    color: '#38BDF8',
    colorLight: '#0369A1',
    color2: '#3B82F6',
    seo: {
      title: 'AbhiMate: AI Multi-Agent QA Automation',
      description:
        'Describe a feature in plain English, get a runnable BDD test suite. A multi-agent AI QA platform with 11 agents, Selenium & Playwright, visual regression and self-healing locators.',
      og: '/og-abhimate.png',
    },
    // Hosted demo is offline for now, so no live link: the open-source repo is the way in.
    primary: { label: 'View source on GitHub', href: 'https://github.com/Abhi-tech-geek/AbhiMate' },
    overviewTitle: 'The overview',
    overview: [
      "AbhiMate is an end-to-end QA automation platform built around a multi-agent architecture. Instead of writing test scripts by hand, you describe what you want to test in plain English and eleven specialized AI agents handle the rest: language understanding, DOM analysis, BDD test generation, browser execution, failure root-cause analysis and reporting.",
      'Every test runs through an engine-agnostic Action Plan (typed JSON, never raw code), so the same suite runs on both Selenium and Playwright. It ships with visual regression, accessibility checks, performance budgets, parallel execution, scheduling with Slack alerts, self-healing locators, and a Chrome extension that records real sessions and imports them as runnable tests.',
    ],
    featuresTitle: 'Key features',
    featuresLead: 'Thirteen production features. These are the ones that matter most.',
    features: [
      { title: '11 AI agents', desc: 'Generate, run and triage tests autonomously across the full pipeline.' },
      { title: 'BDD output', desc: 'Clean Gherkin test cases across five distinct categories.' },
      { title: 'Engine-agnostic', desc: 'Selenium and Playwright are interchangeable via a typed Action Plan.' },
      { title: 'Visual regression', desc: 'Pixel-diff every screen against approved baselines.' },
      { title: 'Parallel execution', desc: 'Multi-worker concurrent runs for fast, scalable suites.' },
      { title: 'Self-healing locators', desc: 'Tests survive UI changes by re-resolving elements automatically.' },
      { title: 'Scheduling + Slack', desc: 'Runs on a schedule with instant Slack notifications.' },
      { title: 'Record & replay', desc: 'A Chrome extension records real sessions and imports them as tests.' },
      { title: 'Accessibility & perf', desc: 'Built-in axe-core checks and Web Vitals budgets.' },
      { title: 'Mobile emulation', desc: 'Nine device presets to test responsive behaviour.' },
    ],
    stack: ['Python', 'Flask', 'SQLite', 'Selenium', 'Playwright', 'Chrome', 'Docker', 'JavaScript', 'Groq AI', 'Pytest'],
    metrics: [
      { value: '13', count: 13, label: 'Production features' },
      { value: '441', count: 441, label: 'Automated tests passing' },
      { value: '11', count: 11, label: 'Specialized AI agents' },
      { value: '36', count: 36, label: 'Browser operations' },
    ],
    runLocally: [
      { comment: '# 1. Clone the code' },
      { cmd: 'git clone https://github.com/Abhi-tech-geek/AbhiMate' },
      { cmd: 'cd AbhiMate' },
      { comment: '# 2. Create a virtual environment' },
      { cmd: 'python -m venv venv' },
      { cmd: 'venv\\Scripts\\activate' },
      { comment: '# 3. Install dependencies' },
      { cmd: 'pip install -r requirements.txt' },
      { comment: '# 4. Add your key to .env  →  GROQ_API_KEY=gsk_xxxxxxxx' },
      { comment: '# 5. Show the browser  →  ABHIMATE_HEADLESS=false' },
      { comment: '# 6. Run it, then open http://localhost:5000' },
      { cmd: 'python app.py' },
    ],
    cta: { title: 'Try AbhiMate on your machine', text: 'The hosted demo is offline for now. The code is open and runs locally in a few minutes.' },
    next: 'aurago',
  },
  {
    slug: 'aurago',
    name: 'AuraGo',
    category: 'AI travel planner',
    tagline: "Go where the crowd isn't.",
    short: 'Eight verified hidden-gem trips from a vibe and a budget, each with a full day-by-day plan.',
    status: 'paused',
    statusLabel: 'Demo offline',
    color: '#F59E0B',
    colorLight: '#B45309',
    color2: '#FBBF24',
    seo: {
      title: 'AuraGo: AI Travel Planner for Hidden Gems',
      description:
        'Turn a rough idea and a budget into eight verified hidden-gem destinations, each with a complete day-by-day plan, live weather, stays, routes and real booking links.',
      og: '/og-aurago.png',
    },
    // Hosted demo is offline for now (Cloud Run returns 503), so no live link.
    primary: { label: 'View source on GitHub', href: 'https://github.com/Abhi-tech-geek/AuraGo' },
    overviewTitle: 'The overview',
    overview: [
      'AuraGo helps people discover places they would never find on a typical "top 10" list. You describe a vibe and a budget; it returns eight off-the-beaten-path destinations (five domestic, three international), ranked by an AI value score. Open any one and it expands into a full itinerary: day-by-day plan, live weather, stays, a route map, transport choices, a packing list and real booking links.',
      'It runs in two modes, Sasta (budget) and Elite (premium), which reshape the suggestions, the costs and the entire visual theme. Lock a trip and you get a shareable read-only link anyone can open without signing in.',
    ],
    featuresTitle: 'What it does',
    features: [
      { title: 'Discovery, not search', desc: 'Eight curated picks biased toward lesser-known places, with honest crowd and budget feasibility.' },
      { title: 'Full plans in seconds', desc: 'Itinerary, weather, hotels, packing list, route map and transport sized to the real distance.' },
      { title: 'Plan together', desc: 'Invite friends with one link to edit live, run polls and chat in real time.' },
      { title: 'Refine in plain language', desc: '"Make it cheaper," "keep Day 2 indoors," or re-plan around the live forecast.' },
      { title: 'Share anywhere', desc: 'Locked trips become public, login-free pages.' },
      { title: 'Two modes', desc: 'Sasta and Elite reshape suggestions, costs and the whole theme.' },
    ],
    highlights: [
      { title: 'Multi-step LLM orchestration', desc: 'Groq (Llama 3.3 70B) with separate stages for intent, candidates and itinerary, each returning strict JSON.' },
      { title: 'Live web grounding', desc: 'Serper.dev verifies places, prices and weather instead of trusting the model blindly.' },
      { title: 'Real-time collaboration', desc: 'Supabase change-data-capture, with row-level security keeping every trip private by default.' },
      { title: 'Budget & transport realism', desc: 'Distance-aware costing and a rule engine that never suggests a train across an ocean.' },
      { title: 'One container, anywhere', desc: 'Express API and the React app ship as one Docker image on Cloud Run.' },
    ],
    stack: ['React 19', 'Vite', 'Tailwind', 'Framer Motion', 'Node 20', 'Express 5', 'Supabase', 'Groq AI', 'Serper.dev', 'Docker', 'Cloud Run'],
    metrics: [
      { value: '8', count: 8, label: 'Destinations per search' },
      { value: '5+3', label: 'Domestic + international' },
      { value: '2', count: 2, label: 'Travel modes' },
      { value: '1', count: 1, label: 'Docker image for the whole app' },
    ],
    cta: { title: 'See how AuraGo is built', text: 'The hosted demo is offline for now. The full source is on GitHub.' },
    next: 'discova',
  },
  {
    slug: 'discova',
    name: 'DISCOVA',
    category: 'Accessibility app',
    tagline: 'Know if you can get in before you go.',
    short: 'AI-scored ramps, lifts, washrooms and parking, so you know you can get in before you go.',
    status: 'android',
    statusLabel: 'Android',
    color: '#10B981',
    colorLight: '#047857',
    color2: '#06B6D4',
    seo: {
      title: 'DISCOVA: AI Accessibility & Discovery App',
      description:
        'Know if you can get in before you go. An AI app that scores how accessible cafes, malls and parks are for wheelchair users, seniors, strollers and sensory needs.',
      og: '/og-discova.png',
    },
    primary: { label: 'Download APK', href: 'https://github.com/Abhi-tech-geek/Discova/releases/download/v1.0.12/discova.apk' },
    secondary: { label: 'Releases', href: 'https://github.com/Abhi-tech-geek/Discova/releases' },
    overviewTitle: 'The problem',
    overview: [
      'For millions of people the question isn\'t "where should I go?" It\'s "will I be able to get in, use the washroom, and feel comfortable once I\'m there?" Today that is guesswork. You find out a place has stairs only after you arrive.',
      'DISCOVA fixes that. It combines the discovery feel of Instagram and Google Maps with real accessibility intelligence, so you know before you leave home exactly what to expect. Built for people with disabilities, and just as much for parents, seniors and anyone who values comfort.',
    ],
    featuresTitle: 'Core features',
    features: [
      { title: 'AI accessibility score', desc: 'Gemini reads photos and reviews to rate ramps, lifts, washrooms and parking.' },
      { title: 'Real places near you', desc: 'Live Google places rated 3.9+ with real photos. No fake listings.' },
      { title: 'Crowd & quiet meter', desc: 'How busy a place is, and the calmest time to visit.' },
      { title: 'Universal Comfort Index', desc: 'Parking, walking distance, seating and calm, scored for everyone.' },
      { title: 'Hidden gems, weather-aware', desc: 'Underrated spots, and indoor picks when it rains.' },
      { title: 'Community reviews', desc: 'Real users rate accessibility, keeping every score honest.' },
      { title: 'Visit nudge', desc: 'Move 3 km away from a place and DISCOVA gently asks you to rate it.' },
      { title: 'Gamification', desc: 'Coins (2× for PwD users), challenges, a leaderboard and stories.' },
    ],
    stack: ['React Native', 'Expo SDK 54', 'TypeScript', 'Firebase', 'Gemini 2.5', 'Groq / Llama', 'Google Maps', 'Open-Meteo', 'NativeWind', 'Zustand'],
    metrics: [
      { value: 'Live', label: 'Working Android APK' },
      { value: 'Real', label: 'Live data + AI' },
      { value: '₹0', label: 'Runs on free tier' },
      { value: '2×', label: 'Coins for PwD users' },
    ],
    cta: { title: 'Try DISCOVA on Android', text: 'Download the APK and check a place before you go.' },
    next: 'abhinova',
  },
  {
    slug: 'abhinova',
    name: 'AbhiNova',
    category: 'AI chatbot',
    tagline: 'Your personal AI assistant.',
    short: 'A Jarvis-style chatbot on a multi-agent core. Version 2.0 is being rebuilt with a new orchestration engine.',
    status: 'soon',
    statusLabel: 'v2.0 soon',
    color: '#EC4899',
    colorLight: '#BE185D',
    color2: '#A855F7',
    seo: {
      title: 'AbhiNova 2.0: Personal AI Assistant',
      description:
        'AbhiNova is a Jarvis-style personal AI chatbot built on a multi-agent core. Version 2.0 is in development with a new orchestration engine.',
      og: '/og-abhinova.png',
    },
    primary: { label: 'Follow on GitHub', href: 'https://github.com/Abhi-tech-geek?tab=repositories' },
    overviewTitle: 'The idea',
    overview: [
      'AbhiNova is a Jarvis-style personal assistant. You talk to one chatbot; behind it, a multi-agent core breaks your request into tasks and delegates each to a specialized agent, then brings the answers back as one reply.',
      'It is currently being rebuilt as AbhiNova 2.0 with a new orchestration engine. A full case study lands when it ships.',
    ],
    featuresTitle: "What's coming in 2.0",
    features: [
      { title: 'New orchestration core', desc: 'A redesigned engine that routes tasks across specialized agents more reliably.' },
      { title: 'Natural conversation', desc: 'Speak or type. AbhiNova plans, reasons and acts across your tools.' },
      { title: 'Faster, smarter agents', desc: 'Lower latency and better tool use on the latest LLMs.' },
    ],
    stack: ['Multi-agent', 'LLM orchestration', 'Tool use', 'Voice + text'],
    metrics: [],
    cta: { title: 'AbhiNova 2.0 is on the way', text: 'Follow along on GitHub to see it ship.' },
    next: 'abhimate',
  },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug)!;
