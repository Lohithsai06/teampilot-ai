# PM MODE IMPLEMENTATION GUIDE

## Overview

PM Mode transforms the AI into a Senior Technical Project Manager. When activated, the AI provides:

1. **Project Understanding** - Deep analysis of project goals and scope
2. **Roadmap Generation** - Multi-phase development roadmaps
3. **Team Work Distribution** - Automatic task assignment based on roles
4. **Sprint Planning** - Detailed sprint plans with task breakdown
5. **Kanban Generation** - Structured task board with clear status flow
6. **Risk Analysis** - Identification of blockers and mitigation strategies

## Mode Selection

### UI Integration
- Click **"PM Mode"** badge in the AI Workspace chat header
- Active mode is highlighted in blue
- Mode selection is persisted to Firestore for each project

### Mode Persistence
- Stored in `agentSessions` Firestore collection
- Format: `{projectId}_{userId}`
- Automatically restored when returning to project

```typescript
interface AgentSession {
  projectId: string;
  activeMode: "architect" | "pm" | "vibe-coding" | "github"
  userId: string;
  updatedAt: Timestamp;
}
```

## Context Injection

Before every AI request, PM Mode includes:

```
CURRENT PROJECT CONTEXT
=======================

Project Name: {projectName}
Project Description: {projectDescription}
Current Phase: {currentPhase}
Total Members: {totalMembers}
Total Tasks: {totalTasks}
Completed Tasks: {completedTasks}
Leader: {leaderName}

Current User: {userName}
User Role: {userRole}

Team Members:
- {name} ({role})
- {name} ({role})
```

## PM Response Structure

The PM Agent always structures responses as:

```
1. Project Understanding
   - Summarizes project goals and scope
   
2. Roadmap
   - Phase 1: ...
   - Phase 2: ...
   - Phase 3: ...

3. Phase Breakdown
   - Detailed breakdown of each phase

4. Sprint Plan
   - Sprint 1 tasks with estimates

5. Team Work Distribution
   - Frontend Dev: Task 1, Task 2
   - Backend Dev: Task 3, Task 4
   - etc.

6. Kanban Tasks
   - Backlog: [list of tasks]
   - Todo: [list of tasks]
   - etc.

7. Risks & Blockers
   - Risk 1: mitigation
   - Risk 2: mitigation

8. Progress Recommendations
   - Next key actions

9. Next Actions
   - Immediate action items
```

## Task Generation & Storage

### Automatic Task Creation (Future Enhancement)

When PM Mode generates tasks, they can be automatically saved:

```typescript
interface Task {
  projectId: string;
  title: string;
  description: string;
  assignedTo: string;           // userId
  assignedToName: string;
  assignedToRole: string;        // developer role
  phase: number;
  sprint: number;
  priority: "high" | "medium" | "low";
  status: "backlog" | "todo" | "in-progress" | "review" | "testing" | "completed";
  estimatedHours?: number;
  dependencies?: string[];
  createdAt: Timestamp;
  createdBy: string;             // PM userId
}
```

### Task Storage

Tasks are stored in Firestore `tasks` collection:

```bash
firestore
├── projects/{projectId}
├── projectMembers/{projectId}_{userId}
├── tasks/{taskId}                    ← PM-generated tasks
├── aiChats/{chatId}
└── agentSessions/{projectId}_{userId}
```

## Team Work Splitting

### Role Detection

PM Agent analyzes team structure:

```
Team Members:
- Alice (Frontend Developer)
- Bob (Backend Developer)
- Charlie (AI/ML Engineer)
- Diana (DevOps Engineer)
```

### Automatic Assignment

PM Agent matches tasks to roles:

**Frontend Developer (Alice)**:
- Login UI component
- Dashboard layout
- Kanban board UI
- Form validation

**Backend Developer (Bob)**:
- Firestore schema design
- API endpoints
- Authentication logic
- Database migrations

**AI Engineer (Charlie)**:
- Prompt engineering
- Model integration
- Context optimization
- RAG implementation

**DevOps (Diana)**:
- Infrastructure setup
- Deployment pipeline
- Monitoring
- Environment configuration

## Usage Examples

### Example 1: MVP for a Chat App

**User Input**:
> I want to build a real-time chat application with authentication, message storage, and notifications.

**PM Mode Response**:

```
1. Project Understanding
   ✓ Real-time chat application
   ✓ Multi-user support
   ✓ Message persistence
   ✓ Push notifications
   ✓ Authentication required
   
2. Roadmap
   Phase 1 (Week 1): Foundation
   - Firebase setup, authentication
   - Database schema
   
   Phase 2 (Week 2): Core Chat
   - Message service
   - Real-time sync
   - UI components
   
   Phase 3 (Week 3): Features
   - Notifications
   - User profiles
   - Typing indicators
   
   Phase 4 (Week 4): Polish
   - Testing
   - Deployment
   
3. Sprint Plan
   Sprint 1: Foundation
   - Task: Setup Firebase project (Bob, 4h)
   - Task: Design Firestore schema (Bob, 3h)
   - Task: Implement authentication (Bob, 5h)
   - Task: Create login page (Alice, 4h)
   
4. Team Work Distribution
   Frontend (Alice): 25 tasks
   Backend (Bob): 20 tasks
   DevOps (Diana): 8 tasks
   
5. Kanban Tasks
   [Detailed task list with status]
   
6. Risks
   - Real-time sync complexity
   - Notification delivery timing
   - Firestore quota limits
   
7. Next Actions
   - Setup Firebase project
   - Design database schema
   - Create authentication flow
```

### Example 2: E-Commerce Platform

**User Input**:
> Build a scalable e-commerce platform with product catalog, shopping cart, payments, and admin dashboard.

**PM Mode Response** would include:

- **5-6 phases** spanning 8-12 weeks
- **80+ tasks** distributed across team
- **Risk analysis** for payment processing
- **Infrastructure recommendations**
- **Scaling considerations**

## UI Features

### Mode Indicator
- Shows active mode in badge (PM Mode)
- Shows PM Agent status
- Displays AI provider status

### Context Display
- Project summary card
- Team member avatars
- Progress metrics
- Phase indicators

### Future: Task Board Integration
- Kanban board view
- Task filtering
- Workload visualization
- Assignment management

## API Integration

### System Prompt Injection

```typescript
const systemPrompt = buildSystemPrompt(context, "pm");
// Includes full PM Agent instructions + project context

await sendAndRespond(message, settings, systemPrompt);
```

### Response Handling

```typescript
// PM Agent returns structured response
// Future: Parse and extract tasks
// Save to Firestore tasks collection
// Update project metrics
```

## Firestore Collections

```
agentSessions/
  {projectId}_{userId}/
    projectId: string
    activeMode: "pm" | "architect" | ...
    userId: string
    updatedAt: Timestamp

tasks/
  {taskId}/
    projectId: string
    title: string
    assignedTo: string
    assignedToName: string
    assignedToRole: string
    status: "backlog" | "todo" | ...
    phase: number
    sprint: number
    priority: "high" | "medium" | "low"
    createdAt: Timestamp
    createdBy: string
```

## Next Steps

1. ✅ PM mode instructions complete
2. ✅ Mode selection UI ready
3. ✅ Mode persistence implemented
4. ⏳ Task parsing & auto-save (optional)
5. ⏳ Task board UI (optional)
6. ⏳ Workload visualization (optional)

## Testing PM Mode

### Test 1: Mode Selection
1. Go to AI Workspace
2. Click "PM Mode" badge
3. Verify badge highlights in blue
4. Refresh page
5. Verify PM Mode is still selected

### Test 2: PM Response
1. Ask: "Plan a todo app with auth and notifications"
2. AI should respond with full structure:
   - Project Understanding
   - Roadmap (3-4 phases)
   - Team Work Distribution
   - Kanban Tasks
   - Risks

### Test 3: Team Work Splitting
1. Ask PM to plan a project
2. Verify tasks are split by role:
   - Frontend: UI tasks
   - Backend: API tasks
   - AI: ML tasks
   - DevOps: Infrastructure tasks

### Test 4: Context Awareness
1. Ask PM about project status
2. AI should reference:
   - Project name
   - Team members
   - Current phase
   - Progress metrics

## Performance Considerations

- System prompt is ~2KB (minimal impact)
- Mode persistence is single Firestore write per mode change
- Task creation is batch-friendly (multiple tasks in single request)
- Context injection adds <100ms to request time

## Security & Permissions

- Mode persistence only for authenticated users
- Task creation respects Firestore rules
- Only project members can see project context
- PM Agent doesn't bypass security rules
