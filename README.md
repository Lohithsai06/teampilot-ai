# TeamPilot AI

AI-powered software execution operating system for teams. Plan, collaborate, and execute software projects intelligently.

## Features

- AI-Powered Planning - Discuss ideas with AI and get intelligent roadmaps
- Visual Roadmaps - See your project journey from idea to deployment
- Team Collaboration - Assign roles, track workload, share context
- GitHub Integration - Track commits with AI-powered summaries
- Prompt Generation - Generate IDE-ready prompts for Cursor, TRAE, Bolt, v0
- Kanban Execution - Drag-and-drop task management
- Three Theme Modes - Light, Dark, and Premium Hybrid

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Shadcn-style UI Components
- Framer Motion
- Lucide Icons
- Supabase (Database & Auth)
- Recharts (Analytics)

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and configure your environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Dashboard home
│   ├── ai-workspace/       # AI chat & prompt generation
│   ├── projects/           # Project management
│   ├── roadmap/            # Roadmap timeline
│   ├── kanban/             # Kanban board
│   ├── team/               # Team management
│   ├── github/             # GitHub integration
│   ├── settings/           # User settings
│   ├── login/              # Login page
│   └── register/           # Registration page
├── components/
│   ├── ui/                 # Base UI components
│   ├── common/             # Shared components
│   ├── landing/            # Landing page sections
│   ├── auth/               # Authentication forms
│   └── ...                 # Feature-specific components
├── lib/                    # Utilities and configs
├── context/                # React contexts
├── hooks/                  # Custom hooks
├── types/                  # TypeScript types
└── services/               # API services
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | User login |
| `/register` | User registration |
| `/dashboard` | Main dashboard |
| `/ai-workspace` | AI chat and prompt generation |
| `/projects` | Project list and management |
| `/roadmap` | Project roadmap timeline |
| `/kanban` | Task board |
| `/team` | Team members and workload |
| `/github` | GitHub integration dashboard |
| `/settings` | User and app settings |

## Theme Customization

The app supports three themes:
- **Light** - Clean, professional SaaS feel
- **Dark** - Easy on the eyes for long coding sessions
- **Hybrid** - Futuristic glassmorphism with violet accents

Switch themes using the theme toggle in the navbar or in Settings.

## Database

Uses Supabase for:
- User authentication
- Project data storage
- Real-time collaboration
- Row-level security

Configure Supabase by adding your project URL and anon key to `.env.local`.

## License

MIT
