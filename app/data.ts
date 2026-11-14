export type SectionId = "resume" | "links" | "experience" | "projects";

export const profile = {
  greeting: "Hello, I am Riti",
  tagline: "I am a Software Engineer",
};

export const menu: { id: SectionId; label: string; icon: string }[] = [
  { id: "resume", label: "Resume", icon: "📄" },
  { id: "links", label: "Links", icon: "🔗" },
  { id: "experience", label: "Experience", icon: "💼" },
  { id: "projects", label: "Projects", icon: "🚀" },
];

// Edit everything below with your real details.
export const resume = {
  summary:
    "Software engineer who loves building fast, friendly products. Write a short summary about yourself here.",
  skills: ["TypeScript", "React", "Next.js", "Node.js", "Three.js", "SQL", "Git"],
  education: [{ title: "B.Tech, Computer Science", place: "Your University", years: "20XX – 20XX" }],
  downloadUrl: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/resume.pdf`, // put your resume file in the public/ folder
};

export const links = [
  { name: "GitHub", url: "https://github.com/", text: "github.com/your-username" },
  { name: "LinkedIn", url: "https://linkedin.com/", text: "linkedin.com/in/your-profile" },
  { name: "Email", url: "mailto:you@example.com", text: "you@example.com" },
];

export const experience = [
  {
    role: "Software Engineer",
    company: "Company Name",
    years: "2023 – Present",
    points: ["Built and shipped features used by thousands of users.", "Improved performance and reliability."],
  },
  {
    role: "Software Engineer Intern",
    company: "Another Company",
    years: "2022",
    points: ["Worked on an internal tool with a small team."],
  },
];

export const projects = [
  { name: "Project One", desc: "Short description of what it does.", tech: ["React", "Node.js"], url: "#" },
  { name: "Project Two", desc: "Short description of what it does.", tech: ["Next.js", "SQL"], url: "#" },
  { name: "Project Three", desc: "Short description of what it does.", tech: ["Three.js", "TypeScript"], url: "#" },
];
