export const site = {
  name: 'Abhinav Saxena',
  role: 'QA & Automation Engineer',
  company: 'Accenture',
  location: 'Gurgaon, India',
  url: 'https://theabhinavsaxena.in',
  email: 'abhinav.ujjwal98@gmail.com',
  linkedin: 'https://www.linkedin.com/in/abhinav-saxena-5a4017123/',
  github: 'https://github.com/Abhi-tech-geek',
  resume: '/AbhinavSaxena.pdf',
  description:
    'Abhinav Saxena, QA & Automation Engineer at Accenture. I build AI agents that write, run and explain tests, and apps that make the real world more accessible.',
};

export const stats = [
  { value: 2, suffix: '+', label: 'Years in QA' },
  { value: 250, suffix: '+', label: 'Test cases executed' },
  { value: 4, suffix: '', label: 'AI projects built' },
  { value: 5, suffix: '', label: 'Certifications' },
];

export const workflow = [
  {
    key: 'requirement',
    title: 'Requirement analysis',
    desc: 'Study the stories, map testable scenarios and flag ambiguities early, before a single test is written.',
    tools: ['Jira', 'Confluence', 'User stories'],
    deliverable: 'Scenarios + clarification log',
  },
  {
    key: 'design',
    title: 'Test design',
    desc: 'Happy paths, edge cases and business rules, with every case traceable back to its requirement.',
    tools: ['ALM', 'RTM', 'Sheets'],
    deliverable: 'Test cases + traceability matrix',
  },
  {
    key: 'execution',
    title: 'Execution',
    desc: 'Functional, integration and end-to-end cycles on every build, with evidence for each result.',
    tools: ['ALM', 'DevTools', 'Postman'],
    deliverable: 'Execution report with evidence',
  },
  {
    key: 'defects',
    title: 'Defect reporting',
    desc: 'Clear repro steps, severity, screenshots and logs, tracked until verified closed.',
    tools: ['Jira', 'Bug lifecycle', 'Triage'],
    deliverable: 'Actionable bug reports',
  },
  {
    key: 'automation',
    title: 'Automation',
    desc: 'Stable, repetitive flows automated with Selenium and Python, cutting regression time for the whole team.',
    tools: ['Selenium', 'Python', 'TestNG', 'Robot'],
    deliverable: 'Reusable automation suite',
  },
  {
    key: 'signoff',
    title: 'Regression & sign-off',
    desc: 'Run the regression pack, validate data with SQL, then give the release its quality sign-off.',
    tools: ['Regression suite', 'SQL', 'Release checklist'],
    deliverable: 'Release sign-off',
  },
];

export const journey = [
  {
    when: 'Present',
    title: 'QA Tester',
    org: 'Accenture',
    points: [
      'Manual and functional testing for large-scale enterprise applications.',
      'Designed and executed test cases covering edge cases and business rules.',
      'Automated repetitive workflows with Selenium, TestNG, Robot Framework and Python.',
      'Managed the full bug lifecycle in Jira and validated data with SQL.',
    ],
  },
  {
    when: 'Graduated',
    title: 'Bachelor of Computer Applications',
    org: 'Lovely Professional University',
    points: ['Foundations in computer science, programming and the software development lifecycle.'],
  },
];

export const certs = [
  {
    org: 'Google Cloud',
    title: 'Build Search & Recommendation Applications with AI',
    date: 'May 2026',
    id: 'GCP-SRAI-26804',
    color: '#4285F4',
    badge: 'Verified',
  },
  {
    org: 'Accenture',
    title: 'Reinvention with Agentic AI Learning Program',
    date: 'Apr 2026',
    id: 'ACN-REAI-84021',
    color: '#A100FF',
    badge: 'Verified',
  },
  {
    org: 'IndiaAI',
    title: 'India AI Impact Buildathon 2026',
    date: 'Mar 2026',
    id: 'IND-AI-IMPACT-2026',
    color: '#FF9933',
    badge: 'Awarded',
  },
  {
    org: 'Databricks',
    title: 'Certified Data Engineer Professional',
    date: 'Jun 2026',
    id: '186202462',
    color: '#FF3621',
    badge: 'Verified',
  },
  {
    org: 'Databricks',
    title: 'Certified Data Engineer Associate',
    date: 'Jun 2026',
    id: '186202443',
    color: '#FF3621',
    badge: 'Verified',
  },
];

export const toolbelt = [
  'Selenium', 'Playwright', 'Python', 'Pytest', 'TestNG', 'Robot Framework', 'Jira', 'SQL',
  'Postman', 'Docker', 'Groq', 'Gemini', 'React', 'Supabase', 'Firebase', 'Databricks',
];

/** Skills grouped by what I can do, for the new UI. `at` = where I use it. */
export type SkillUse = 'work' | 'projects' | 'learning';
export const capabilities: {
  title: string;
  summary: string;
  tools: { name: string; at: SkillUse }[];
}[] = [
  {
    title: 'Quality assurance and manual testing',
    summary: 'Functional and end-to-end testing of large enterprise apps, test case design that covers the edges, and defects tracked through their full lifecycle.',
    tools: [
      { name: 'Jira', at: 'work' },
      { name: 'ALM', at: 'work' },
      { name: 'SQL', at: 'work' },
      { name: 'Postman', at: 'work' },
    ],
  },
  {
    title: 'Web test automation',
    summary: 'Automating the stable, repetitive flows so regression runs take less of the team’s time.',
    tools: [
      { name: 'Selenium', at: 'work' },
      { name: 'Python', at: 'work' },
      { name: 'TestNG', at: 'work' },
      { name: 'Robot Framework', at: 'work' },
      { name: 'Playwright', at: 'projects' },
      { name: 'Pytest', at: 'projects' },
    ],
  },
  {
    title: 'Mobile test automation',
    summary: 'Extending the same automation habits to Android and iOS apps.',
    tools: [{ name: 'Appium', at: 'learning' }],
  },
  {
    title: 'AI and intelligent applications',
    summary: 'Multi-agent systems, model pipelines that return strict JSON, and answers checked against live data.',
    tools: [
      { name: 'Groq / Llama', at: 'projects' },
      { name: 'Gemini', at: 'projects' },
      { name: 'Agentic AI', at: 'projects' },
    ],
  },
  {
    title: 'Development tools and workflow',
    summary: 'What I use to build and ship my own projects.',
    tools: [
      { name: 'Git and GitHub', at: 'projects' },
      { name: 'Docker', at: 'projects' },
      { name: 'Flask', at: 'projects' },
      { name: 'React', at: 'projects' },
      { name: 'React Native', at: 'projects' },
      { name: 'Supabase', at: 'projects' },
      { name: 'Firebase', at: 'projects' },
    ],
  },
];
