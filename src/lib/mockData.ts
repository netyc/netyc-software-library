export type Commit = {
  id: string;
  message: string;
  author: string;
  timestamp: string;
  content: string; // The content of the file at this commit
};

export type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: FileNode[];
  updatedAt: string;
  commitMessage: string;
  history?: Commit[];
  rawUrl?: string; // URL to fetch lazy content from
  uploaderId?: string;
};

export type Repository = {
  id: string;
  name: string;
  owner: string;
  description: string;
  isPrivate: boolean;
  language: string;
  stars: number;
  forks: number;
  updatedAt: string;
  files: FileNode[];
  ownerId?: string;
  addedBy?: string;
  addedByPhoto?: string;
};

export const MOCK_USER = {
  username: "naufal",
  fullName: "Naufal M",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=naufal",
  bio: "Fullstack Developer | Open Source Enthusiast",
};

export const MOCK_REPOSITORIES: Repository[] = [
  {
    id: "repo-1",
    name: "nexus-core",
    owner: "naufal",
    description: "The core engine for the Nexus digital storage platform.",
    isPrivate: false,
    language: "TypeScript",
    stars: 128,
    forks: 34,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    files: [
      {
        id: "f1",
        name: "src",
        type: "folder",
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        commitMessage: "Refactor core engine",
        children: [
          {
            id: "f2",
            name: "index.ts",
            type: "file",
            updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            commitMessage: "Refactor core engine",
            content: "export const init = () => console.log('Nexus core initialized');\nexport const shutdown = () => console.log('Nexus core stopped');",
            history: [
              {
                id: "c6b8c9d",
                message: "Refactor core engine",
                author: "naufal",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                content: "export const init = () => console.log('Nexus core initialized');\nexport const shutdown = () => console.log('Nexus core stopped');"
              },
              {
                id: "a1b2c3d",
                message: "Initial commit",
                author: "naufal",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
                content: "export const init = () => console.log('Nexus core initialized');"
              }
            ]
          },
        ],
      },
      {
        id: "f3",
        name: "README.md",
        type: "file",
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        commitMessage: "Update docs",
        content: "# Nexus Core\n\nThe most advanced digital repository engine.",
      },
      {
        id: "f4",
        name: "package.json",
        type: "file",
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        commitMessage: "Bump dependencies",
        content: "{\n  \"name\": \"nexus-core\",\n  \"version\": \"1.0.0\"\n}",
      }
    ],
  },
  {
    id: "repo-2",
    name: "react-ui-components",
    owner: "naufal",
    description: "A collection of beautiful, reusable React components.",
    isPrivate: false,
    language: "TypeScript",
    stars: 45,
    forks: 12,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
    files: [
      {
        id: "r2-f1",
        name: "README.md",
        type: "file",
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        commitMessage: "Initial commit",
        content: "# React UI Components\n\nA beautiful component library.",
      }
    ],
  },
  {
    id: "repo-3",
    name: "personal-website",
    owner: "naufal",
    description: "My minimalistic personal portfolio built with Next.js.",
    isPrivate: false,
    language: "JavaScript",
    stars: 12,
    forks: 2,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 1 week ago
    files: [],
  },
  {
    id: "repo-4",
    name: "secret-project",
    owner: "naufal",
    description: "Shh, it's a secret.",
    isPrivate: true,
    language: "Rust",
    stars: 0,
    forks: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    files: [],
  }
];
