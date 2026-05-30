import { NextRequest, NextResponse } from "next/server";

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

interface FetchGitHubDataRequest {
  owner: string;
  repo: string;
  token?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FetchGitHubDataRequest = await request.json();
    const { owner, repo, token } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and repo are required" },
        { status: 400 }
      );
    }

    // Prepare headers
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    // Fetch commits (latest 20)
    const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=20`;
    const commitsResponse = await fetch(commitsUrl, {
      headers,
    });

    if (!commitsResponse.ok) {
      if (commitsResponse.status === 404) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        );
      }
      if (commitsResponse.status === 403) {
        return NextResponse.json(
          { error: "Rate limit exceeded or access denied" },
          { status: 403 }
        );
      }
      throw new Error(`GitHub API error: ${commitsResponse.status}`);
    }

    const commits: GitHubCommit[] = await commitsResponse.json();

    // Fetch branches
    let branches: GitHubBranch[] = [];
    try {
      const branchesUrl = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`;
      const branchesResponse = await fetch(branchesUrl, {
        headers,
      });

      if (branchesResponse.ok) {
        branches = await branchesResponse.json();
      }
    } catch (err) {
      console.error("[GitHub API] Error fetching branches:", err);
      // Continue without branches
    }

    // Get repository info
    let repoInfo: any = {};
    try {
      const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
      const repoResponse = await fetch(repoUrl, {
        headers,
      });

      if (repoResponse.ok) {
        const data = await repoResponse.json();
        repoInfo = {
          description: data.description,
          stars: data.stargazers_count,
          forks: data.forks_count,
          language: data.language,
          updatedAt: data.updated_at,
        };
      }
    } catch (err) {
      console.error("[GitHub API] Error fetching repo info:", err);
    }

    return NextResponse.json({
      commits,
      branches,
      repoInfo,
      owner,
      repo,
      totalCommits: commits.length,
      totalBranches: branches.length,
    });
  } catch (error) {
    console.error("[GitHub API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub data" },
      { status: 500 }
    );
  }
}
