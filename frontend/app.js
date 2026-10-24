/**
 * VIKASA — Frontend Application Logic
 * Integrates directly with VIKASA FastAPI backend for:
 * - Project management (CRUD)
 * - Task management & tracking
 * - Empirical Evidence Collection (Git status, diff, safe execution)
 * - Deterministic Claim vs Reality Verification
 * - System diagnostics (Ollama, Antigravity, SQLite)
 */

(function () {
  'use strict';

  // State Management
  const state = {
    apiBase: localStorage.getItem('vikasa_api_base') || '',
    projects: [],
    selectedProjectId: null,
    tasks: [],
    currentEvidence: [],
    systemHealth: null,
  };

  // DOM Elements
  const elements = {
    statusPill: document.getElementById('system-status-pill'),
    statusText: document.getElementById('system-status-text'),
    projectSelector: document.getElementById('project-selector'),
    projectsContainer: document.getElementById('projects-container'),
    tasksContainer: document.getElementById('tasks-container'),
    tasksHeaderSubtitle: document.getElementById('tasks-header-subtitle'),
    toastContainer: document.getElementById('toast-container'),

    // Tab buttons & panels
    tabButtons: document.querySelectorAll('.nav-link'),
    panels: document.querySelectorAll('.section-panel'),

    // Modals
    modalNewProject: document.getElementById('modal-new-project'),
    btnOpenNewProjectModal: document.getElementById('btn-open-new-project-modal'),
    btnCancelProjectModal: document.getElementById('btn-cancel-project-modal'),
    btnSubmitProject: document.getElementById('btn-submit-project'),
    inputProjectName: document.getElementById('modal-project-name'),
    inputProjectPath: document.getElementById('modal-project-path'),
    inputProjectUrl: document.getElementById('modal-project-url'),

    modalNewTask: document.getElementById('modal-new-task'),
    btnOpenNewTaskModal: document.getElementById('btn-open-new-task-modal'),
    btnCancelTaskModal: document.getElementById('btn-cancel-task-modal'),
    btnSubmitTask: document.getElementById('btn-submit-task'),
    inputTaskTitle: document.getElementById('modal-task-title'),
    inputTaskDesc: document.getElementById('modal-task-desc'),
    inputTaskCriteria: document.getElementById('modal-task-criteria'),

    // Verification Studio elements
    verifyTaskTitle: document.getElementById('verify-task-title'),
    verifyTaskDesc: document.getElementById('verify-task-desc'),
    verifyTaskCriteria: document.getElementById('verify-task-criteria'),
    verifyAgentName: document.getElementById('verify-agent-name'),
    verifyClaimStatement: document.getElementById('verify-claim-statement'),
    verifyClaimSuccess: document.getElementById('verify-claim-success'),
    verifyRepoPath: document.getElementById('verify-repo-path'),
    verifyTestCmd: document.getElementById('verify-test-cmd'),
    btnCollectLiveEvidence: document.getElementById('btn-collect-live-evidence'),
    btnRunVerification: document.getElementById('btn-run-verification'),
    verdictHeroContainer: document.getElementById('verdict-hero-container'),
    discrepanciesBox: document.getElementById('discrepancies-box'),
    discrepanciesList: document.getElementById('discrepancies-list'),
    rulesEvaluationsList: document.getElementById('rules-evaluations-list'),
    evidenceItemsList: document.getElementById('evidence-items-list'),
    evidenceCountBadge: document.getElementById('evidence-count-badge'),

    // Demo buttons
    btnLoadDemoPass: document.getElementById('btn-load-demo-pass'),
    btnLoadDemoFail: document.getElementById('btn-load-demo-fail'),
    btnLoadDemoUnsub: document.getElementById('btn-load-demo-unsub'),

    // Refresh buttons
    btnRefreshProjects: document.getElementById('btn-refresh-projects'),
    btnRefreshTasks: document.getElementById('btn-refresh-tasks'),
    btnRefreshDiagnostics: document.getElementById('btn-refresh-diagnostics'),

    // Diagnostics
    diagApiBadge: document.getElementById('diag-api-badge'),
    diagApiService: document.getElementById('diag-api-service'),
    diagApiVersion: document.getElementById('diag-api-version'),
    diagDbBadge: document.getElementById('diag-db-badge'),
    diagDbStatus: document.getElementById('diag-db-status'),
    diagOllamaBadge: document.getElementById('diag-ollama-badge'),
    diagOllamaReady: document.getElementById('diag-ollama-ready'),
    diagAntigravityBadge: document.getElementById('diag-antigravity-badge'),
    diagAntigravitySdk: document.getElementById('diag-antigravity-sdk'),
    diagAntigravityCli: document.getElementById('diag-antigravity-cli'),

    // Settings
    settingsApiBase: document.getElementById('settings-api-base'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
  };

  // Helper: Toast Notifications
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const borderColor = type === 'error' ? 'var(--verdict-fail)' : (type === 'success' ? 'var(--verdict-pass)' : 'var(--accent-cyan)');
    toast.style.borderColor = borderColor;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // API Client
  async function apiRequest(endpoint, options = {}) {
    const url = `${state.apiBase}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail = (data && data.detail) || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorDetail);
      }

      return data;
    } catch (err) {
      console.error(`API request error on ${endpoint}:`, err);
      throw err;
    }
  }

  // Navigation Logic
  function switchTab(tabId) {
    elements.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    elements.panels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });

    if (tabId === 'diagnostics') {
      loadDiagnostics();
    }
  }

  // 1. Projects Management
  async function loadProjects() {
    elements.projectsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="spinner"></span>
        <p style="margin-top: 12px;">Loading registered projects...</p>
      </div>`;

    try {
      const projects = await apiRequest('/api/projects');
      state.projects = projects;
      renderProjects(projects);
      updateProjectSelector(projects);
    } catch (err) {
      elements.projectsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">&#9888;</div>
          <p>Failed to load projects: ${err.message}</p>
          <button id="btn-retry-projects" class="btn btn-secondary btn-sm" style="margin-top: 12px;">Retry</button>
        </div>`;
      document.getElementById('btn-retry-projects')?.addEventListener('click', loadProjects);
    }
  }

  function renderProjects(projects) {
    if (!projects || projects.length === 0) {
      elements.projectsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">&#128193;</div>
          <h3>No Projects Registered</h3>
          <p>Register your first project workspace to start tracking and verifying tasks.</p>
          <button id="btn-empty-new-proj" class="btn btn-primary btn-sm" style="margin-top: 16px;">+ Register Project</button>
        </div>`;
      document.getElementById('btn-empty-new-proj')?.addEventListener('click', () => {
        elements.modalNewProject.classList.add('active');
      });
      return;
    }

    elements.projectsContainer.innerHTML = projects.map(p => `
      <div class="card" data-project-id="${p.id}">
        <div class="card-title">
          <span>${escapeHtml(p.name)}</span>
          <span class="badge badge-pass">${p.analysis_status || 'ACTIVE'}</span>
        </div>
        <p class="card-desc">Root: <code>${escapeHtml(p.root_path)}</code></p>
        <div class="card-meta">
          <span>ID: ${p.id}</span>
          ${p.repository_url ? `<span>Repo: ${escapeHtml(p.repository_url)}</span>` : ''}
          <span>Created: ${new Date(p.created_at).toLocaleString()}</span>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="btn btn-primary btn-sm btn-select-proj" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
            Open Tasks
          </button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.btn-select-proj').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        state.selectedProjectId = id;
        elements.projectSelector.value = id;
        switchTab('tasks');
        loadTasks(id);
      });
    });
  }

  function updateProjectSelector(projects) {
    elements.projectSelector.innerHTML = '<option value="">Select a Project...</option>' +
      projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

    if (state.selectedProjectId) {
      elements.projectSelector.value = state.selectedProjectId;
    }
  }

  async function handleCreateProject() {
    const name = elements.inputProjectName.value.trim();
    const rootPath = elements.inputProjectPath.value.trim();
    const repoUrl = elements.inputProjectUrl.value.trim() || null;

    if (!name || !rootPath) {
      showToast('Project name and root path are required.', 'error');
      return;
    }

    try {
      elements.btnSubmitProject.disabled = true;
      elements.btnSubmitProject.textContent = 'Creating...';

      const created = await apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: name,
          root_path: rootPath,
          repository_url: repoUrl,
        }),
      });

      showToast(`Project "${created.name}" created successfully!`, 'success');
      elements.modalNewProject.classList.remove('active');
      elements.inputProjectName.value = '';
      elements.inputProjectPath.value = '';
      elements.inputProjectUrl.value = '';

      state.selectedProjectId = created.id;
      await loadProjects();
    } catch (err) {
      showToast(`Failed to create project: ${err.message}`, 'error');
    } finally {
      elements.btnSubmitProject.disabled = false;
      elements.btnSubmitProject.textContent = 'Create Project';
    }
  }

  // 2. Tasks Management
  async function loadTasks(projectId) {
    if (!projectId) {
      elements.tasksContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">&#128269;</div>
          <h3>No Project Selected</h3>
          <p>Select an active project from the top header to manage its backlog.</p>
        </div>`;
      return;
    }

    const proj = state.projects.find(p => p.id === projectId);
    elements.tasksHeaderSubtitle.textContent = proj ? `Tasks under "${proj.name}"` : 'Project tasks';

    elements.tasksContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="spinner"></span>
        <p style="margin-top: 12px;">Loading project tasks...</p>
      </div>`;

    try {
      const tasks = await apiRequest(`/api/projects/${projectId}/tasks`);
      state.tasks = tasks;
      renderTasks(tasks);
    } catch (err) {
      elements.tasksContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">&#9888;</div>
          <p>Failed to load tasks: ${err.message}</p>
        </div>`;
    }
  }

  function renderTasks(tasks) {
    if (!tasks || tasks.length === 0) {
      elements.tasksContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">&#9989;</div>
          <h3>No Tasks Yet</h3>
          <p>Create a task to define acceptance criteria and verify development.</p>
          <button id="btn-empty-new-task" class="btn btn-primary btn-sm" style="margin-top: 16px;">+ Create Task</button>
        </div>`;
      document.getElementById('btn-empty-new-task')?.addEventListener('click', () => {
        elements.modalNewTask.classList.add('active');
      });
      return;
    }

    elements.tasksContainer.innerHTML = tasks.map(t => `
      <div class="card" data-task-id="${t.id}">
        <div class="card-title">
          <span>${escapeHtml(t.title)}</span>
          <span class="badge badge-not_run">${t.status || 'PLANNED'}</span>
        </div>
        <p class="card-desc">${escapeHtml(t.description || 'No description provided.')}</p>
        
        ${t.acceptance_criteria ? `
          <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; font-family: var(--font-mono); color: #cbd5e1;">
            <strong>Acceptance Criteria:</strong>
            <pre style="white-space: pre-wrap; margin-top: 4px;">${escapeHtml(t.acceptance_criteria)}</pre>
          </div>
        ` : ''}

        <div class="card-meta">
          <span>ID: ${t.id}</span>
          <span>Created: ${new Date(t.created_at).toLocaleString()}</span>
        </div>

        <button class="btn btn-secondary btn-sm btn-verify-task" data-id="${t.id}" style="margin-top: 8px;">
          Send to Verification Studio &rarr;
        </button>
      </div>
    `).join('');

    document.querySelectorAll('.btn-verify-task').forEach(btn => {
      btn.addEventListener('click', () => {
        const task = state.tasks.find(t => t.id === btn.dataset.id);
        if (task) {
          populateVerificationStudio(task);
          switchTab('verification');
        }
      });
    });
  }

  async function handleCreateTask() {
    if (!state.selectedProjectId) {
      showToast('Please select a project first.', 'error');
      return;
    }

    const title = elements.inputTaskTitle.value.trim();
    const desc = elements.inputTaskDesc.value.trim();
    const criteria = elements.inputTaskCriteria.value.trim();

    if (!title) {
      showToast('Task title is required.', 'error');
      return;
    }

    try {
      elements.btnSubmitTask.disabled = true;
      elements.btnSubmitTask.textContent = 'Creating...';

      const created = await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          project_id: state.selectedProjectId,
          title: title,
          description: desc,
          acceptance_criteria: criteria || null,
        }),
      });

      showToast(`Task "${created.title}" created successfully!`, 'success');
      elements.modalNewTask.classList.remove('active');
      elements.inputTaskTitle.value = '';
      elements.inputTaskDesc.value = '';
      elements.inputTaskCriteria.value = '';

      await loadTasks(state.selectedProjectId);
    } catch (err) {
      showToast(`Failed to create task: ${err.message}`, 'error');
    } finally {
      elements.btnSubmitTask.disabled = false;
      elements.btnSubmitTask.textContent = 'Create Task';
    }
  }

  // 3. Verification Studio
  function populateVerificationStudio(task) {
    elements.verifyTaskTitle.value = task.title;
    elements.verifyTaskDesc.value = task.description || '';
    elements.verifyTaskCriteria.value = task.acceptance_criteria || '[AC-1] Implementation passes verification';
    elements.verifyClaimStatement.value = `Completed task "${task.title}" with verified implementation.`;
    showToast(`Loaded task "${task.title}" into Verification Studio.`, 'info');
  }

  async function handleCollectLiveEvidence() {
    const repoPath = elements.verifyRepoPath.value.trim();
    const testCmd = elements.verifyTestCmd.value.trim();

    if (!repoPath) {
      showToast('Please specify a repository path to inspect.', 'error');
      return;
    }

    try {
      elements.btnCollectLiveEvidence.disabled = true;
      elements.btnCollectLiveEvidence.textContent = 'Collecting...';

      const payload = {
        repo_path: repoPath,
        test_command: testCmd ? testCmd.split(' ').filter(Boolean) : null,
      };

      const evidenceItems = await apiRequest('/api/verify/collect', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      state.currentEvidence = evidenceItems;
      elements.evidenceCountBadge.textContent = evidenceItems.length;
      elements.evidenceItemsList.textContent = JSON.stringify(evidenceItems, null, 2);

      showToast(`Collected ${evidenceItems.length} empirical evidence item(s).`, 'success');
    } catch (err) {
      showToast(`Evidence collection failed: ${err.message}`, 'error');
    } finally {
      elements.btnCollectLiveEvidence.disabled = false;
      elements.btnCollectLiveEvidence.textContent = 'Collect Live Evidence';
    }
  }

  async function handleRunVerification() {
    const title = elements.verifyTaskTitle.value.trim();
    const desc = elements.verifyTaskDesc.value.trim();
    const criteriaRaw = elements.verifyTaskCriteria.value.trim();
    const agentName = elements.verifyAgentName.value.trim() || 'Agent';
    const statement = elements.verifyClaimStatement.value.trim();
    const claimedSuccess = elements.verifyClaimSuccess.checked;

    const criteriaLines = criteriaRaw.split('\n').filter(Boolean);
    const criteria = criteriaLines.map((line, idx) => {
      let id = `AC-${idx + 1}`;
      let text = line.trim();
      const match = line.match(/^\[(.*?)\]\s*(.*)$/);
      if (match) {
        id = match[1];
        text = match[2];
      }
      return { id: id, description: text, required: true };
    });

    const taskPayload = {
      id: 'task-verify-' + Date.now().toString(36),
      title: title,
      description: desc,
      acceptance_criteria: criteria,
    };

    const claimPayload = {
      task_id: taskPayload.id,
      agent_name: agentName,
      claimed_success: claimedSuccess,
      statement: statement,
      git_diff: state.currentEvidence.find(e => e.evidence_type === 'GIT_DIFF')?.content || null,
      evidence_list: state.currentEvidence,
    };

    try {
      elements.btnRunVerification.disabled = true;
      elements.btnRunVerification.innerHTML = '<span class="spinner" style="width:16px; height:16px;"></span> Verifying...';

      const report = await apiRequest('/api/verify/claim-vs-reality', {
        method: 'POST',
        body: JSON.stringify({
          task: taskPayload,
          claim: claimPayload,
        }),
      });

      renderVerificationReport(report);
      showToast(`Verification completed: Verdict ${report.verdict}`, report.claim_verified ? 'success' : 'error');
    } catch (err) {
      showToast(`Verification failed: ${err.message}`, 'error');
    } finally {
      elements.btnRunVerification.disabled = false;
      elements.btnRunVerification.textContent = 'Run Claim vs Reality Evaluation';
    }
  }

  function renderVerificationReport(report) {
    const verdict = report.verdict;
    const confidencePct = Math.round((report.verification_result?.confidence_score || 0) * 100);

    // Hero Verdict Banner
    elements.verdictHeroContainer.innerHTML = `
      <div class="verdict-hero ${verdict}">
        <span class="badge badge-${verdict.toLowerCase()}">${report.claim_verified ? '&#10004; CLAIM VERIFIED' : '&#10008; CLAIM DISCREPANCY'}</span>
        <div class="verdict-title">${verdict}</div>
        <p style="font-size: 0.95rem; font-weight: 500;">${escapeHtml(report.verification_result?.summary || '')}</p>
        <div style="width: 100%; max-width: 300px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">
            <span>Deterministic Confidence</span>
            <span>${confidencePct}%</span>
          </div>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${confidencePct}%;"></div>
          </div>
        </div>
      </div>
    `;

    // Discrepancies
    if (report.discrepancies && report.discrepancies.length > 0) {
      elements.discrepanciesBox.style.display = 'block';
      elements.discrepanciesList.innerHTML = report.discrepancies.map(d => `
        <div class="discrepancy-card">
          &#9888; ${escapeHtml(d)}
        </div>
      `).join('');
    } else {
      elements.discrepanciesBox.style.display = 'none';
      elements.discrepanciesList.innerHTML = '';
    }

    // Rules breakdown
    const rules = report.verification_result?.rule_evaluations || [];
    elements.rulesEvaluationsList.innerHTML = rules.map(r => `
      <div class="rule-item">
        <div>
          <div class="rule-name">${escapeHtml(r.rule_name)}</div>
          <div class="rule-msg">${escapeHtml(r.message)}</div>
        </div>
        <span class="badge badge-${r.passed ? 'pass' : 'fail'}">${r.passed ? 'PASSED' : r.verdict_impact}</span>
      </div>
    `).join('');

    // Evidence
    const evidenceList = report.agent_claim?.evidence_list || [];
    elements.evidenceCountBadge.textContent = evidenceList.length;
    elements.evidenceItemsList.textContent = JSON.stringify(evidenceList, null, 2);
  }

  // Demo Presets
  function loadDemoPass() {
    elements.verifyTaskTitle.value = "Implement deterministic verification engine";
    elements.verifyTaskDesc.value = "Evaluate claims using rule-based deterministic checks.";
    elements.verifyTaskCriteria.value = "[AC-1] DeterministicVerificationEngine class implemented\n[AC-2] Passes unit tests with exit code 0";
    elements.verifyAgentName.value = "AntigravityWorker";
    elements.verifyClaimStatement.value = "Implementation completed, tests passing with zero exit code.";
    elements.verifyClaimSuccess.checked = true;

    state.currentEvidence = [
      {
        criterion_id: "AC-1",
        evidence_type: "FILE_CONTENT",
        content: "class DeterministicVerificationEngine:\n    def evaluate(self, task, claim): ...",
        exit_code: 0,
        passed: true,
      },
      {
        criterion_id: "AC-2",
        evidence_type: "COMMAND_EXIT_CODE",
        content: "pytest tests/ - 10 passed in 0.42s",
        exit_code: 0,
        passed: true,
      },
      {
        criterion_id: null,
        evidence_type: "GIT_DIFF",
        content: "diff --git a/engine.py b/engine.py\n+ class DeterministicVerificationEngine:",
        exit_code: 0,
        passed: true,
      }
    ];

    elements.evidenceCountBadge.textContent = state.currentEvidence.length;
    elements.evidenceItemsList.textContent = JSON.stringify(state.currentEvidence, null, 2);
    showToast("Loaded 'Demo PASS' template with verified test outputs and diff.", "info");
  }

  function loadDemoFail() {
    elements.verifyTaskTitle.value = "Add strict test integrity rule";
    elements.verifyTaskDesc.value = "Fails task if any command exit code is non-zero.";
    elements.verifyTaskCriteria.value = "[AC-1] Test suite passes without failures";
    elements.verifyAgentName.value = "OverconfidentWorker";
    elements.verifyClaimStatement.value = "I am completely done! (Ignoring 1 failed assertion)";
    elements.verifyClaimSuccess.checked = true;

    state.currentEvidence = [
      {
        criterion_id: "AC-1",
        evidence_type: "COMMAND_EXIT_CODE",
        content: "FAILED tests/test_core.py::test_rule - AssertionError: Expected PASS but got FAIL",
        exit_code: 1, // Non-zero exit code!
        passed: false,
      },
      {
        criterion_id: null,
        evidence_type: "GIT_DIFF",
        content: "diff --git a/core.py b/core.py\n+ bug",
        exit_code: 0,
        passed: true,
      }
    ];

    elements.evidenceCountBadge.textContent = state.currentEvidence.length;
    elements.evidenceItemsList.textContent = JSON.stringify(state.currentEvidence, null, 2);
    showToast("Loaded 'Demo FAIL' template with failing exit code 1.", "error");
  }

  function loadDemoUnsubstantiated() {
    elements.verifyTaskTitle.value = "Verify security sandbox";
    elements.verifyTaskDesc.value = "Ensure shell execution is blocked.";
    elements.verifyTaskCriteria.value = "[AC-1] Sandbox verified";
    elements.verifyAgentName.value = "HallucinatingAgent";
    elements.verifyClaimStatement.value = "Trust me, everything is completed!";
    elements.verifyClaimSuccess.checked = true;

    state.currentEvidence = []; // Zero evidence!
    elements.evidenceCountBadge.textContent = 0;
    elements.evidenceItemsList.textContent = "[] (Zero evidence attached)";
    showToast("Loaded 'Demo Unsubstantiated' template with zero evidence.", "info");
  }

  // 4. Diagnostics Management
  async function loadDiagnostics() {
    elements.diagApiBadge.textContent = "Checking...";
    elements.diagDbBadge.textContent = "Checking...";
    elements.diagOllamaBadge.textContent = "Checking...";
    elements.diagAntigravityBadge.textContent = "Checking...";

    // 1. Core Health
    try {
      const health = await apiRequest('/api/health');
      const isHealthy = health.status === 'healthy';
      elements.diagApiBadge.textContent = isHealthy ? 'ONLINE' : 'DEGRADED';
      elements.diagApiBadge.className = `badge badge-${isHealthy ? 'pass' : 'blocked'}`;
      elements.diagApiService.textContent = `Service: ${health.service || 'VIKASA API'}`;
      elements.diagApiVersion.textContent = `Version: ${health.version || '0.1.0'}`;

      elements.diagDbBadge.textContent = health.database === 'connected' ? 'CONNECTED' : 'DISCONNECTED';
      elements.diagDbBadge.className = `badge badge-${health.database === 'connected' ? 'pass' : 'fail'}`;
      elements.diagDbStatus.textContent = `Status: ${health.database}`;

      // Update header status pill
      elements.statusPill.className = `status-pill ${isHealthy ? '' : 'degraded'}`;
      elements.statusText.textContent = isHealthy ? 'API Online' : 'Degraded';
    } catch (err) {
      elements.diagApiBadge.textContent = 'OFFLINE';
      elements.diagApiBadge.className = 'badge badge-fail';
      elements.statusPill.className = 'status-pill offline';
      elements.statusText.textContent = 'API Offline';
    }

    // 2. Ollama Readiness
    try {
      const ollama = await apiRequest('/api/health/ollama');
      const ready = ollama.model_ready;
      elements.diagOllamaBadge.textContent = ready ? 'READY' : (ollama.available ? 'MODEL PENDING' : 'OFFLINE');
      elements.diagOllamaBadge.className = `badge badge-${ready ? 'pass' : (ollama.available ? 'blocked' : 'not_run')}`;
      elements.diagOllamaReady.textContent = `Readiness: ${ready ? 'Model Loaded' : (ollama.error || 'Awaiting Ollama runtime')}`;
    } catch {
      elements.diagOllamaBadge.textContent = 'UNAVAILABLE';
      elements.diagOllamaBadge.className = 'badge badge-not_run';
      elements.diagOllamaReady.textContent = 'Readiness: Ollama instance unreachable';
    }

    // 3. Antigravity Capabilities
    try {
      const agy = await apiRequest('/api/health/antigravity');
      const statusText = agy.status || 'CHECKED';
      elements.diagAntigravityBadge.textContent = statusText;
      elements.diagAntigravityBadge.className = `badge badge-${agy.sdk_installed || agy.cli_installed ? 'pass' : 'blocked'}`;
      elements.diagAntigravitySdk.textContent = `SDK Installed: ${agy.sdk_installed ? 'Yes' : 'No'}`;
      elements.diagAntigravityCli.textContent = `CLI Installed: ${agy.cli_installed ? 'Yes' : 'No'}`;
    } catch {
      elements.diagAntigravityBadge.textContent = 'UNAVAILABLE';
      elements.diagAntigravityBadge.className = 'badge badge-not_run';
    }
  }

  // 5. Settings
  function handleSaveSettings() {
    const val = elements.settingsApiBase.value.trim().replace(/\/+$/, '');
    state.apiBase = val;
    localStorage.setItem('vikasa_api_base', val);
    showToast('Saved API Base URL: ' + (val || 'Same Origin'), 'success');
    loadDiagnostics();
    loadProjects();
  }

  // Utility
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Event Listeners Initialization
  function initEvents() {
    // Navigation
    elements.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Project selector
    elements.projectSelector.addEventListener('change', (e) => {
      state.selectedProjectId = e.target.value;
      if (state.selectedProjectId) {
        loadTasks(state.selectedProjectId);
      }
    });

    // Refresh buttons
    elements.btnRefreshProjects.addEventListener('click', loadProjects);
    elements.btnRefreshTasks.addEventListener('click', () => {
      if (state.selectedProjectId) loadTasks(state.selectedProjectId);
    });
    elements.btnRefreshDiagnostics.addEventListener('click', loadDiagnostics);

    // Modals
    elements.btnOpenNewProjectModal.addEventListener('click', () => {
      elements.modalNewProject.classList.add('active');
    });
    elements.btnCancelProjectModal.addEventListener('click', () => {
      elements.modalNewProject.classList.remove('active');
    });
    elements.btnSubmitProject.addEventListener('click', handleCreateProject);

    elements.btnOpenNewTaskModal.addEventListener('click', () => {
      if (!state.selectedProjectId) {
        showToast('Please select or create an active project first.', 'error');
        return;
      }
      elements.modalNewTask.classList.add('active');
    });
    elements.btnCancelTaskModal.addEventListener('click', () => {
      elements.modalNewTask.classList.remove('active');
    });
    elements.btnSubmitTask.addEventListener('click', handleCreateTask);

    // Verification Studio actions
    elements.btnCollectLiveEvidence.addEventListener('click', handleCollectLiveEvidence);
    elements.btnRunVerification.addEventListener('click', handleRunVerification);

    elements.btnLoadDemoPass.addEventListener('click', loadDemoPass);
    elements.btnLoadDemoFail.addEventListener('click', loadDemoFail);
    elements.btnLoadDemoUnsub.addEventListener('click', loadDemoUnsubstantiated);

    // Settings
    elements.settingsApiBase.value = state.apiBase;
    elements.btnSaveSettings.addEventListener('click', handleSaveSettings);
  }

  // Bootstrap
  async function init() {
    initEvents();
    await loadDiagnostics();
    await loadProjects();
  }

  // Run on DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
