import fs from 'fs';
import path from 'path';

/**
 * Persistent Memory & Goal Store for Muse AI Agent
 * Retains user preferences, durable task state machine, and long-term context.
 */
export class MemoryStore {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.dataDir = path.join(this.workspaceRoot, '.mose');
    this.memoryFile = path.join(this.dataDir, 'memory.json');
    this.goalsFile = path.join(this.dataDir, 'goals.json');
    this.tasksFile = path.join(this.dataDir, 'tasks.json');
    this.init();
  }

  init() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.memoryFile)) {
      const defaultMemory = [
        { id: 'mem_1', key: 'Language', value: 'English (US)', category: 'preference', timestamp: new Date().toISOString() },
        { id: 'mem_2', key: 'Flight Preference', value: 'Window seat, direct flights under $600', category: 'travel', timestamp: new Date().toISOString() },
        { id: 'mem_3', key: 'Browser Sandbox', value: 'Isolated agent profile with credential separation', category: 'security', timestamp: new Date().toISOString() }
      ];
      fs.writeFileSync(this.memoryFile, JSON.stringify(defaultMemory, null, 2), 'utf8');
    }
    if (!fs.existsSync(this.goalsFile)) {
      const defaultGoals = [
        { id: 'goal_1', title: 'Compare laptop prices under ₹80,000', status: 'completed', progress: 100, step: 'Completed', createdAt: new Date().toISOString() },
        { id: 'goal_2', title: 'Track Tokyo flight deals under $600', status: 'active', progress: 65, step: 'Comparing airline routes', createdAt: new Date().toISOString() }
      ];
      fs.writeFileSync(this.goalsFile, JSON.stringify(defaultGoals, null, 2), 'utf8');
    }
    if (!fs.existsSync(this.tasksFile)) {
      fs.writeFileSync(this.tasksFile, JSON.stringify([], null, 2), 'utf8');
    }
  }

  getMemories() {
    try {
      return JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
    } catch {
      return [];
    }
  }

  addMemory({ key, value, category = 'general' }) {
    const memories = this.getMemories();
    const newEntry = {
      id: `mem_${Date.now()}`,
      key,
      value,
      category,
      timestamp: new Date().toISOString()
    };
    memories.push(newEntry);
    fs.writeFileSync(this.memoryFile, JSON.stringify(memories, null, 2), 'utf8');
    return newEntry;
  }

  deleteMemory(id) {
    let memories = this.getMemories();
    memories = memories.filter(m => m.id !== id);
    fs.writeFileSync(this.memoryFile, JSON.stringify(memories, null, 2), 'utf8');
    return true;
  }

  getGoals() {
    try {
      return JSON.parse(fs.readFileSync(this.goalsFile, 'utf8'));
    } catch {
      return [];
    }
  }

  saveGoal({ title, status = 'active', progress = 0, step = 'Initialized' }) {
    const goals = this.getGoals();
    const newGoal = {
      id: `goal_${Date.now()}`,
      title,
      status, // 'queued' | 'planning' | 'running' | 'waiting_approval' | 'completed' | 'failed'
      progress,
      step,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    goals.unshift(newGoal);
    fs.writeFileSync(this.goalsFile, JSON.stringify(goals, null, 2), 'utf8');
    return newGoal;
  }

  updateGoal(id, updates = {}) {
    const goals = this.getGoals();
    const idx = goals.findIndex(g => g.id === id);
    if (idx !== -1) {
      goals[idx] = { ...goals[idx], ...updates, updatedAt: new Date().toISOString() };
      fs.writeFileSync(this.goalsFile, JSON.stringify(goals, null, 2), 'utf8');
      return goals[idx];
    }
    return null;
  }

  // Durable Task Recovery
  getIncompleteTasks() {
    return this.getGoals().filter(g => g.status === 'active' || g.status === 'running' || g.status === 'waiting_approval');
  }
}
