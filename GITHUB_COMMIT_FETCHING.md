# Real GitHub Commit Fetching Integration

## Overview

The GitHub page now fetches real commit data from GitHub repositories using the GitHub API. When a repository is connected, it automatically fetches the latest 20 commits and displays them in the Development Activity Timeline.

## Features Implemented

### 1. GitHub API Integration
- **Endpoint**: `/api/github-sync`
- **Method**: POST
- **Fetches**:
  - Latest 20 commits
  - Repository branches
  - Repository metadata (stars, forks, language)

### 2. Automatic Sync on Connection
When you connect a repository:
1. Repository URL is saved to Firestore
2. GitHub API is called to fetch commits
3. Commits are stored in the `githubActivity` collection
4. Timeline updates automatically

### 3. Manual Sync Button
A "Sync Repository" button appears on connected repositories:
- Click to fetch the latest commits
- Shows loading state while syncing
- Clears old commits before adding new ones
- Provides feedback on success/failure

### 4. Repository Information Display
The repository card now shows:
- Repository name and URL
- Default branch
- Connected status
- Sync button
- Repository stats (stars, language)

## Technical Implementation

### API Route: `/api/github-sync`

**Request:**
```typescript
{
  owner: string;      // e.g., "Lohithsai06"
  repo: string;       // e.g., "teampilot-ai"
  token?: string;     // Optional GitHub token for increased rate limits
}
```

**Response:**
```typescript
{
  commits: GitHubCommit[];
  branches: GitHubBranch[];
  repoInfo: {
    description: string;
    stars: number;
    forks: number;
    language: string;
    updatedAt: string;
  };
  owner: string;
  repo: string;
  totalCommits: number;
  totalBranches: number;
}
```

### Hook: `useGitHubSync`

Provides sync logic with error handling:

```typescript
const { syncRepository, syncing, error, parseGitHubUrl } = useGitHubSync();

// Sync a repository
const result = await syncRepository(projectId, repoUrl, token);

if (result.success) {
  console.log(`Synced ${result.commitsAdded} commits`);
}
```

### URL Parsing

Supports multiple GitHub URL formats:
- `https://github.com/owner/repo`
- `https://github.com/owner/repo.git`
- `git@github.com:owner/repo.git`

## Firestore Storage

### Collection: `githubActivity`

Each synced commit is stored as:

```typescript
{
  projectId: string;           // Project ID
  authorName: string;          // Commit author name
  authorId: string;            // GitHub username
  branch: string;              // Branch name
  commitMessage: string;       // Full commit message
  commitHash: string;          // Full SHA
  commitUrl: string;           // GitHub URL to commit
  repository: string;          // "owner/repo"
  committedAt: Timestamp;      // When commit was made
  repoUrl: string;             // Repository URL
  repoInfo: {                  // Repository metadata
    description?: string;
    stars?: number;
    forks?: number;
    language?: string;
    updatedAt?: string;
  };
  createdAt: Timestamp;        // When sync happened
}
```

## Error Handling

The integration gracefully handles:

| Error | Handling |
|-------|----------|
| **Repository not found** | Shows user-friendly error message |
| **Rate limit exceeded** | Informs user to wait or use GitHub token |
| **Invalid URL** | Validates URL format with helpful feedback |
| **Network error** | Displays error and allows retry |
| **Private repository** | Works if user provides valid GitHub token |

## GitHub Token (Optional)

For higher rate limits or private repositories, users can add a GitHub token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Create token with `public_repo` scope
3. Add token in sync request (future UI feature)

Rate limits:
- **Without token**: 60 requests/hour
- **With token**: 5,000 requests/hour

## User Flow

### Connecting a Repository

1. Click "Connect Repository" on GitHub page
2. Enter:
   - Repository URL (e.g., `https://github.com/Lohithsai06/teampilot-ai`)
   - Repository name (for display)
   - Default branch (usually "main")
3. Click "Save Repository"
4. System automatically:
   - Parses the URL
   - Calls GitHub API
   - Fetches commits
   - Stores in Firestore
5. Development Activity Timeline updates

### Syncing Manually

1. Connected repository shows "Sync Repository" button
2. Click button
3. System fetches latest commits
4. Old commits are cleared
5. New commits populate the timeline
6. Shows count of commits synced

## Data Flow Diagram

```
User connects repo
       ↓
Parse GitHub URL (owner/repo)
       ↓
Call GitHub API (/api/github-sync)
       ↓
Fetch commits + branches + metadata
       ↓
Clear old githubActivity docs
       ↓
Store commits in Firestore
       ↓
useGitHubActivity hook detects change
       ↓
DevelopmentActivityTimeline updates
       ↓
User sees commits displayed
```

## API Response Examples

### Success Response

```json
{
  "commits": [
    {
      "sha": "abc123def456",
      "commit": {
        "author": {
          "name": "John Doe",
          "date": "2024-05-28T10:30:00Z"
        },
        "message": "feat: add new feature"
      },
      "author": {
        "login": "johndoe",
        "avatar_url": "https://..."
      },
      "html_url": "https://github.com/owner/repo/commit/abc123def456"
    }
  ],
  "branches": [
    {
      "name": "main",
      "commit": {"sha": "...", "url": "..."}
    },
    {
      "name": "development",
      "commit": {"sha": "...", "url": "..."}
    }
  ],
  "repoInfo": {
    "description": "Project description",
    "stars": 150,
    "forks": 42,
    "language": "TypeScript",
    "updatedAt": "2024-05-28T15:00:00Z"
  },
  "totalCommits": 20,
  "totalBranches": 5
}
```

### Error Response

```json
{
  "error": "Repository not found"
}
```

## Testing the Integration

### Test Case 1: Connect Public Repository

1. Enter: `https://github.com/Lohithsai06/teampilot-ai`
2. Expected: Commits appear in timeline within seconds
3. Verify: Author names, messages, and dates are correct

### Test Case 2: Manual Sync

1. Click "Sync Repository" button
2. Wait for loading to complete
3. Expected: New commits added (if any)
4. Verify: Timeline refreshes

### Test Case 3: Error Handling

1. Enter: `https://github.com/invalid/repo-that-doesnt-exist`
2. Expected: Error message appears
3. Verify: Helpful message guides user

## Future Enhancements

- [ ] GitHub token management in UI
- [ ] Auto-sync on schedule (e.g., every 30 minutes)
- [ ] Pull request data integration
- [ ] Issue tracking integration
- [ ] Branch protection status
- [ ] Actions/CI-CD status display
- [ ] Code change statistics
- [ ] Contributor insights

## Performance Considerations

- **Caching**: Commits are cached in Firestore
- **Real-time updates**: Uses Firestore listeners
- **Rate limiting**: API calls are user-initiated (manual sync)
- **Batch operations**: Clears old and adds new in transaction

## Security Considerations

- GitHub tokens should be stored securely (future: backend storage)
- Public repositories can be fetched without authentication
- Private repositories require valid GitHub token
- No sensitive data is exposed in the UI
