export interface IdeaNode {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  groupId?: string | null;
  lastModified: number; // For Conflict-Free Last-Write-Wins
  userId: string;
  authorName: string;
  title?: string;
}

export interface IdeaConnection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  lastModified: number;
}

export interface IdeaGroup {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lastModified: number;
}

export interface BrainstormBoard {
  id: string;
  name: string;
  nodes: Record<string, IdeaNode>;
  connections: Record<string, IdeaConnection>;
  groups: Record<string, IdeaGroup>;
  lastModified: number;
}

export interface UserSession {
  id: string;
  name: string;
  color: string;
}

export interface SyncPayload {
  boardId: string;
  clientId: string;
  nodes?: Record<string, IdeaNode>;
  connections?: Record<string, IdeaConnection>;
  groups?: Record<string, IdeaGroup>;
  lastModified: number;
}
