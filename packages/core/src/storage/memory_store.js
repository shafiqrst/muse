import fs from 'fs';
import path from 'path';

/**
 * Persistent Memory & Goal Store for Muse AI Agent
 * Retains user preferences, durable task state machine, execution checkpoints, and idempotency records.
 */
export class MemoryStore {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.dataDir = path.join(this.workspaceRoot, '.mose');
    this.memoryFile = path.join(this.dataDir, 'memory.json');
    this.goalsFile = path.join(this.dataDir, 'goals.json');
    this.tasksFile = path.join(this.dataDir, 'tasks.json');
    this.actionsFile = path.join(this.dataDir, 'executed_actions.json');
    this.conversationsFile = path.join(this.dataDir, 'conversations.json');
    this.personaFile = path.join(this.dataDir, 'persona.json');
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
    if (!fs.existsSync(this.actionsFile)) {
      fs.writeFileSync(this.actionsFile, JSON.stringify({}, null, 2), 'utf8');
    }
    if (!fs.existsSync(this.conversationsFile)) {
      const defaultConversations = [
        {
          id: 'conv_main',
          title: 'Main Muse Conversation',
          type: 'main',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      fs.writeFileSync(this.conversationsFile, JSON.stringify(defaultConversations, null, 2), 'utf8');
    }
    if (!fs.existsSync(this.personaFile)) {
      const defaultPersona = {
        name: 'Muse',
        tone: 'friendly',
        voice: 'natural',
        proactivity: 'high'
      };
      fs.writeFileSync(this.personaFile, JSON.stringify(defaultPersona, null, 2), 'utf8');
    }
  }

  // --- Personal Memories ---
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

  // --- High-Level Goals ---
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

  // --- Durable Task Execution State Machine ---
  getTasks() {
    try {
      return JSON.parse(fs.readFileSync(this.tasksFile, 'utf8'));
    } catch {
      return [];
    }
  }

  createTask({ title, goalId = null, metadata = {} }) {
    const tasks = this.getTasks();
    const newTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      goalId,
      status: 'queued', // queued -> planning -> running -> waiting_approval -> completed | failed | paused
      step: 0,
      progress: 0,
      checkpoints: [],
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    tasks.unshift(newTask);
    fs.writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
    return newTask;
  }

  getTask(taskId) {
    const tasks = this.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  saveCheckpoint(taskId, checkpointData = {}) {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      const task = tasks[idx];
      task.step = checkpointData.step || task.step;
      task.progress = checkpointData.progress || task.progress;
      task.status = checkpointData.status || task.status;
      task.updatedAt = new Date().toISOString();
      
      const checkpoint = {
        step: task.step,
        status: task.status,
        description: checkpointData.description || `Checkpoint at step ${task.step}`,
        timestamp: new Date().toISOString()
      };
      
      if (!task.checkpoints) task.checkpoints = [];
      task.checkpoints.push(checkpoint);

      // Save messages snapshot if provided
      if (checkpointData.messages) {
        task.lastMessagesSnapshot = checkpointData.messages;
      }

      fs.writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
      return task;
    }
    return null;
  }

  updateTaskState(taskId, status, updates = {}) {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      tasks[idx] = {
        ...tasks[idx],
        ...updates,
        status,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
      return tasks[idx];
    }
    return null;
  }

  getIncompleteTasks() {
    const activeStatuses = ['queued', 'planning', 'running', 'waiting_approval', 'paused'];
    return this.getTasks().filter(t => activeStatuses.includes(t.status));
  }

  // --- Action Idempotency Guard (Prevents Replaying Duplicate External Actions) ---
  recordActionExecution(idempotencyKey, actionData = {}) {
    try {
      const records = JSON.parse(fs.readFileSync(this.actionsFile, 'utf8'));
      records[idempotencyKey] = {
        ...actionData,
        executedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.actionsFile, JSON.stringify(records, null, 2), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  hasExecutedAction(idempotencyKey) {
    try {
      const records = JSON.parse(fs.readFileSync(this.actionsFile, 'utf8'));
      return Boolean(records[idempotencyKey]);
    } catch {
      return false;
    }
  }

  // --- Conversations & Project Threads ---
  getConversations() {
    try {
      return JSON.parse(fs.readFileSync(this.conversationsFile, 'utf8'));
    } catch {
      return [];
    }
  }

  getConversation(id) {
    const list = this.getConversations();
    return list.find(c => c.id === id) || null;
  }

  createConversation({ title, type = 'project' }) {
    const list = this.getConversations();
    const newConv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title || 'New Conversation',
      type, // 'main' | 'project' | 'research'
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.unshift(newConv);
    fs.writeFileSync(this.conversationsFile, JSON.stringify(list, null, 2), 'utf8');
    return newConv;
  }

  deleteConversation(id) {
    let list = this.getConversations();
    // Do not allow deleting main conversation
    if (id === 'conv_main') return false;
    list = list.filter(c => c.id !== id);
    fs.writeFileSync(this.conversationsFile, JSON.stringify(list, null, 2), 'utf8');
    return true;
  }

  saveConversationMessages(id, messages = []) {
    const list = this.getConversations();
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
      list[idx].messages = messages;
      list[idx].updatedAt = new Date().toISOString();
      fs.writeFileSync(this.conversationsFile, JSON.stringify(list, null, 2), 'utf8');
      return list[idx];
    }
    return null;
  }

  // --- Personal Avatar & Identity ---
  getPersona() {
    try {
      return JSON.parse(fs.readFileSync(this.personaFile, 'utf8'));
    } catch {
      return { name: 'Muse', tone: 'friendly', voice: 'natural', proactivity: 'high' };
    }
  }

  updatePersona(updates = {}) {
    try {
      const current = this.getPersona();
      const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
      fs.writeFileSync(this.personaFile, JSON.stringify(updated, null, 2), 'utf8');
      return updated;
    } catch {
      return null;
    }
  }
}
