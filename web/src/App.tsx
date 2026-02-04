import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient()
const API_BASE = '/api'

// =============================================================================
// Types
// =============================================================================

interface Project {
  id: number
  name: string
  code: string
  status: string
  description?: string
}

interface Asset {
  id: number
  project_id: number
  name: string
  asset_type: string
  status: string
  description?: string
}

interface Shot {
  id: number
  project_id: number
  sequence: string
  name: string
  frame_start: number
  frame_end: number
  status: string
  description?: string
}

interface Task {
  id: number
  entity_type: string
  entity_id: number
  name: string
  status: string
  assignee?: string
  priority: number
}

interface Version {
  id: number
  task_id: number
  version_number: number
  status: string
  path?: string
  notes?: string
  created_by?: string
}

// =============================================================================
// API
// =============================================================================

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`)
  if (!res.ok) throw new Error('Failed to fetch projects')
  return res.json()
}

async function fetchAssets(code: string): Promise<Asset[]> {
  const res = await fetch(`${API_BASE}/projects/${code}/assets`)
  if (!res.ok) throw new Error('Failed to fetch assets')
  return res.json()
}

async function fetchTasks(entityType: string, entityId: number): Promise<Task[]> {
  const base = entityType === 'asset' ? 'assets' : 'shots'
  const res = await fetch(`${API_BASE}/${base}/${entityId}/tasks`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

async function fetchShots(code: string, sequence?: string): Promise<Shot[]> {
  let url = `${API_BASE}/projects/${code}/shots`
  if (sequence) url += `?sequence=${encodeURIComponent(sequence)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch shots')
  return res.json()
}

async function fetchVersions(taskId: number): Promise<Version[]> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/versions`)
  if (!res.ok) throw new Error('Failed to fetch versions')
  return res.json()
}

async function createProject(data: { name: string; code: string; description?: string }): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create project')
  return res.json()
}

async function createAsset(code: string, data: { name: string; asset_type: string }): Promise<Asset> {
  const res = await fetch(`${API_BASE}/projects/${code}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create asset')
  return res.json()
}

async function createShot(code: string, data: { sequence: string; name: string; frame_start: number; frame_end: number; description?: string }): Promise<Shot> {
  const res = await fetch(`${API_BASE}/projects/${code}/shots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create shot')
  return res.json()
}

async function createTaskApi(entityType: string, entityId: number, data: { name: string; assignee?: string; priority: number }): Promise<Task> {
  const base = entityType === 'asset' ? 'assets' : 'shots'
  const res = await fetch(`${API_BASE}/${base}/${entityId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create task')
  return res.json()
}

async function updateTask(taskId: number, data: { status?: string; assignee?: string; priority?: number }): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update task')
  return res.json()
}

async function createVersion(taskId: number, data: { path?: string; notes?: string; created_by?: string }): Promise<Version> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create version')
  return res.json()
}

// =============================================================================
// Helpers
// =============================================================================

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'rw-badge--success',
    approved: 'rw-badge--success',
    complete: 'rw-badge--success',
    in_progress: 'rw-badge--info',
    review: 'rw-badge--warning',
    waiting: '',
    on_hold: '',
    pending_review: 'rw-badge--warning',
  }
  return map[status] || ''
}

const STATUS_CYCLE: Record<string, string> = {
  waiting: 'in_progress',
  in_progress: 'review',
  review: 'approved',
  approved: 'waiting',
}

// =============================================================================
// Views
// =============================================================================

type View =
  | { page: 'projects' }
  | { page: 'project'; project: Project }
  | { page: 'asset'; project: Project; asset: Asset }
  | { page: 'shots'; project: Project }
  | { page: 'shot'; project: Project; shot: Shot }

// =============================================================================
// Task Row with Versions
// =============================================================================

function TaskRow({ task, entityType: _entityType }: { task: Task; entityType: string }) {
  const [expanded, setExpanded] = useState(false)
  const [showCreateVersion, setShowCreateVersion] = useState(false)
  const qc = useQueryClient()

  const { data: versions } = useQuery({
    queryKey: ['versions', task.id],
    queryFn: () => fetchVersions(task.id),
    enabled: expanded,
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => updateTask(task.id, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = STATUS_CYCLE[task.status] || 'waiting'
    statusMutation.mutate(next)
  }

  return (
    <>
      <tr onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <td>
          <span style={{ marginRight: '0.5rem', fontSize: '0.7rem', color: 'var(--rw-text-muted)' }}>
            {expanded ? '▼' : '▶'}
          </span>
          {task.name}
        </td>
        <td>{task.assignee || '—'}</td>
        <td>{task.priority}</td>
        <td>
          <span
            className={`rw-badge rw-badge--sm ${statusBadge(task.status)} og-status-clickable`}
            onClick={cycleStatus}
            title="Click to cycle status"
          >
            {task.status}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={{ padding: 0 }}>
            <div className="og-task-versions">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--rw-space-sm)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--rw-text-muted)', textTransform: 'uppercase' }}>
                  Versions ({versions?.length || 0})
                </span>
                <button
                  className="rw-btn rw-btn--ghost rw-btn--sm"
                  onClick={(e) => { e.stopPropagation(); setShowCreateVersion(true) }}
                >
                  + New Version
                </button>
              </div>
              {versions && versions.length > 0 ? (
                versions.map(v => (
                  <div key={v.id} className="og-version-row">
                    <span className="og-version-row__number">v{String(v.version_number).padStart(3, '0')}</span>
                    <span>{v.path || '—'}</span>
                    <span>{v.notes || ''}</span>
                    <span>{v.created_by || ''}</span>
                    <span className={`rw-badge rw-badge--sm ${statusBadge(v.status)}`}>{v.status}</span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--rw-text-muted)' }}>No versions yet.</p>
              )}
            </div>
            {showCreateVersion && (
              <CreateVersionModal taskId={task.id} onClose={() => setShowCreateVersion(false)} />
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// =============================================================================
// Project List
// =============================================================================

function ProjectsView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [showCreate, setShowCreate] = useState(false)
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  if (isLoading) {
    return (
      <div>
        <div className="og-topbar">
          <div>
            <h1 className="og-topbar__title">Projects</h1>
            <p className="og-topbar__subtitle">All production projects</p>
          </div>
        </div>
        <div className="rw-skeleton rw-skeleton--card" />
      </div>
    )
  }

  if (error) {
    return <div className="rw-badge rw-badge--danger">Error loading projects</div>
  }

  if (!projects?.length) {
    return (
      <div>
        <div className="og-topbar">
          <div>
            <h1 className="og-topbar__title">Projects</h1>
          </div>
        </div>
        <div className="og-empty">
          <div className="og-empty__icon">&#x1f3ac;</div>
          <div className="og-empty__title">No projects yet</div>
          <div className="og-empty__desc">Create your first project to start tracking production.</div>
          <button className="rw-btn rw-btn--primary" onClick={() => setShowCreate(true)}>
            Create Project
          </button>
        </div>
        {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      </div>
    )
  }

  return (
    <div>
      <div className="og-topbar">
        <div>
          <h1 className="og-topbar__title">Projects</h1>
          <p className="og-topbar__subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="rw-btn rw-btn--primary rw-btn--sm" onClick={() => setShowCreate(true)}>
          + New Project
        </button>
      </div>

      <div className="og-projects-grid">
        {projects.map(project => (
          <div
            key={project.id}
            className="rw-card rw-card--interactive"
            onClick={() => onSelect(project)}
          >
            <div className="rw-flex rw-flex--between rw-flex--align-center" style={{ marginBottom: 'var(--rw-space-sm)' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--rw-text)' }}>
                {project.name}
              </span>
              <span className="rw-badge rw-badge--sm">{project.code}</span>
            </div>
            {project.description && (
              <p style={{ fontSize: '0.85rem', color: 'var(--rw-text-secondary)', marginBottom: 'var(--rw-space-sm)' }}>
                {project.description}
              </p>
            )}
            <span className={`rw-badge rw-badge--sm ${statusBadge(project.status)}`}>
              {project.status}
            </span>
          </div>
        ))}
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

// =============================================================================
// Project Detail (asset table)
// =============================================================================

function ProjectDetailView({ project, onSelectAsset, onBack }: {
  project: Project
  onSelectAsset: (a: Asset) => void
  onBack: () => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets', project.code],
    queryFn: () => fetchAssets(project.code),
  })

  const assetsByType: Record<string, Asset[]> = {}
  assets?.forEach(a => {
    if (!assetsByType[a.asset_type]) assetsByType[a.asset_type] = []
    assetsByType[a.asset_type].push(a)
  })

  return (
    <div>
      <div className="og-breadcrumb">
        <a onClick={onBack}>Projects</a>
        <span>/</span>
        <span style={{ color: 'var(--rw-text)' }}>{project.name}</span>
      </div>

      <div className="og-topbar">
        <div>
          <h1 className="og-topbar__title">{project.name}</h1>
          <p className="og-topbar__subtitle">{project.code} &middot; {assets?.length || 0} assets</p>
        </div>
        <button className="rw-btn rw-btn--primary rw-btn--sm" onClick={() => setShowCreate(true)}>
          + New Asset
        </button>
      </div>

      {isLoading && <div className="rw-skeleton rw-skeleton--card" />}

      {!isLoading && !assets?.length && (
        <div className="og-empty">
          <div className="og-empty__icon">&#x1f4e6;</div>
          <div className="og-empty__title">No assets yet</div>
          <div className="og-empty__desc">Add characters, props, environments, and FX to this project.</div>
          <button className="rw-btn rw-btn--primary" onClick={() => setShowCreate(true)}>
            Add Asset
          </button>
        </div>
      )}

      {!isLoading && assets && assets.length > 0 && (
        <div className="og-stats">
          <div className="og-stat">
            <div className="og-stat__label">Total Assets</div>
            <div className="og-stat__value">{assets.length}</div>
          </div>
          <div className="og-stat">
            <div className="og-stat__label">Types</div>
            <div className="og-stat__value">{Object.keys(assetsByType).length}</div>
          </div>
          <div className="og-stat">
            <div className="og-stat__label">In Progress</div>
            <div className="og-stat__value">{assets.filter(a => a.status === 'in_progress').length}</div>
          </div>
          <div className="og-stat">
            <div className="og-stat__label">Approved</div>
            <div className="og-stat__value">{assets.filter(a => a.status === 'approved').length}</div>
          </div>
        </div>
      )}

      {!isLoading && assets && assets.length > 0 && (
        <table className="og-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(asset => (
              <tr key={asset.id} onClick={() => onSelectAsset(asset)}>
                <td>{asset.name}</td>
                <td>{asset.asset_type}</td>
                <td>
                  <span className={`rw-badge rw-badge--sm ${statusBadge(asset.status)}`}>
                    {asset.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && <CreateAssetModal projectCode={project.code} onClose={() => setShowCreate(false)} />}
    </div>
  )
}

// =============================================================================
// Asset Detail (tasks with versions)
// =============================================================================

function AssetDetailView({ project, asset, onBack }: {
  project: Project
  asset: Asset
  onBack: () => void
}) {
  const [showCreateTask, setShowCreateTask] = useState(false)
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', 'asset', asset.id],
    queryFn: () => fetchTasks('asset', asset.id),
  })

  return (
    <div>
      <div className="og-breadcrumb">
        <a onClick={() => onBack()}>Projects</a>
        <span>/</span>
        <a onClick={onBack}>{project.name}</a>
        <span>/</span>
        <span style={{ color: 'var(--rw-text)' }}>{asset.name}</span>
      </div>

      <div className="og-topbar">
        <div>
          <h1 className="og-topbar__title">{asset.name}</h1>
          <p className="og-topbar__subtitle">{asset.asset_type} &middot; {asset.status}</p>
        </div>
        <button className="rw-btn rw-btn--primary rw-btn--sm" onClick={() => setShowCreateTask(true)}>
          + Create Task
        </button>
      </div>

      {asset.description && (
        <p style={{ color: 'var(--rw-text-secondary)', marginBottom: 'var(--rw-space-lg)' }}>
          {asset.description}
        </p>
      )}

      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--rw-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--rw-space-md)' }}>
        Tasks
      </h3>

      {isLoading && <div className="rw-skeleton rw-skeleton--card" />}

      {!isLoading && !tasks?.length && (
        <p style={{ color: 'var(--rw-text-muted)', fontSize: '0.875rem' }}>
          No tasks assigned to this asset.
        </p>
      )}

      {!isLoading && tasks && tasks.length > 0 && (
        <table className="og-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Assignee</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} entityType="asset" />
            ))}
          </tbody>
        </table>
      )}

      {showCreateTask && (
        <CreateTaskModal
          entityType="asset"
          entityId={asset.id}
          onClose={() => setShowCreateTask(false)}
        />
      )}
    </div>
  )
}

// =============================================================================
// Shots View (grouped by sequence)
// =============================================================================

function ShotsView({ project, onSelectShot, onBack }: {
  project: Project
  onSelectShot: (s: Shot) => void
  onBack: () => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [openSequences, setOpenSequences] = useState<Set<string>>(new Set())

  const { data: shots, isLoading } = useQuery({
    queryKey: ['shots', project.code],
    queryFn: () => fetchShots(project.code),
  })

  const shotsBySequence: Record<string, Shot[]> = {}
  shots?.forEach(s => {
    if (!shotsBySequence[s.sequence]) shotsBySequence[s.sequence] = []
    shotsBySequence[s.sequence].push(s)
  })

  const toggleSequence = (seq: string) => {
    setOpenSequences(prev => {
      const next = new Set(prev)
      if (next.has(seq)) next.delete(seq)
      else next.add(seq)
      return next
    })
  }

  return (
    <div>
      <div className="og-breadcrumb">
        <a onClick={onBack}>Projects</a>
        <span>/</span>
        <a onClick={onBack}>{project.name}</a>
        <span>/</span>
        <span style={{ color: 'var(--rw-text)' }}>Shots</span>
      </div>

      <div className="og-topbar">
        <div>
          <h1 className="og-topbar__title">Shots</h1>
          <p className="og-topbar__subtitle">{project.code} &middot; {shots?.length || 0} shots &middot; {Object.keys(shotsBySequence).length} sequences</p>
        </div>
        <button className="rw-btn rw-btn--primary rw-btn--sm" onClick={() => setShowCreate(true)}>
          + New Shot
        </button>
      </div>

      {isLoading && <div className="rw-skeleton rw-skeleton--card" />}

      {!isLoading && !shots?.length && (
        <div className="og-empty">
          <div className="og-empty__icon">&#x1f3ac;</div>
          <div className="og-empty__title">No shots yet</div>
          <div className="og-empty__desc">Add shots to start tracking your sequences.</div>
          <button className="rw-btn rw-btn--primary" onClick={() => setShowCreate(true)}>
            Add Shot
          </button>
        </div>
      )}

      {!isLoading && shots && shots.length > 0 && (
        <div>
          {Object.entries(shotsBySequence).sort(([a], [b]) => a.localeCompare(b)).map(([sequence, seqShots]) => (
            <div key={sequence} style={{ marginBottom: 'var(--rw-space-sm)' }}>
              <div className="og-sequence-header" onClick={() => toggleSequence(sequence)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rw-space-sm)' }}>
                  <span className={`og-sequence-header__arrow ${openSequences.has(sequence) ? 'og-sequence-header__arrow--open' : ''}`}>
                    ▶
                  </span>
                  <span className="og-sequence-header__name">{sequence}</span>
                </div>
                <span className="og-sequence-header__count">{seqShots.length} shot{seqShots.length !== 1 ? 's' : ''}</span>
              </div>
              {openSequences.has(sequence) && (
                <table className="og-table" style={{ marginBottom: 'var(--rw-space-md)' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Frame Range</th>
                      <th>Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seqShots.map(shot => (
                      <tr key={shot.id} onClick={() => onSelectShot(shot)}>
                        <td>{shot.name}</td>
                        <td>{shot.frame_start}–{shot.frame_end}</td>
                        <td>{shot.frame_end - shot.frame_start + 1} frames</td>
                        <td>
                          <span className={`rw-badge rw-badge--sm ${statusBadge(shot.status)}`}>
                            {shot.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateShotModal projectCode={project.code} onClose={() => setShowCreate(false)} />}
    </div>
  )
}

// =============================================================================
// Shot Detail (tasks with versions)
// =============================================================================

function ShotDetailView({ project, shot, onBack }: {
  project: Project
  shot: Shot
  onBack: () => void
}) {
  const [showCreateTask, setShowCreateTask] = useState(false)
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', 'shot', shot.id],
    queryFn: () => fetchTasks('shot', shot.id),
  })

  return (
    <div>
      <div className="og-breadcrumb">
        <a onClick={() => onBack()}>Projects</a>
        <span>/</span>
        <a onClick={onBack}>{project.name}</a>
        <span>/</span>
        <a onClick={onBack}>Shots</a>
        <span>/</span>
        <span style={{ color: 'var(--rw-text)' }}>{shot.name}</span>
      </div>

      <div className="og-topbar">
        <div>
          <h1 className="og-topbar__title">{shot.name}</h1>
          <p className="og-topbar__subtitle">
            {shot.sequence} &middot; {shot.frame_start}–{shot.frame_end} ({shot.frame_end - shot.frame_start + 1} frames) &middot; {shot.status}
          </p>
        </div>
        <button className="rw-btn rw-btn--primary rw-btn--sm" onClick={() => setShowCreateTask(true)}>
          + Create Task
        </button>
      </div>

      {shot.description && (
        <p style={{ color: 'var(--rw-text-secondary)', marginBottom: 'var(--rw-space-lg)' }}>
          {shot.description}
        </p>
      )}

      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--rw-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--rw-space-md)' }}>
        Tasks
      </h3>

      {isLoading && <div className="rw-skeleton rw-skeleton--card" />}

      {!isLoading && !tasks?.length && (
        <p style={{ color: 'var(--rw-text-muted)', fontSize: '0.875rem' }}>
          No tasks assigned to this shot.
        </p>
      )}

      {!isLoading && tasks && tasks.length > 0 && (
        <table className="og-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Assignee</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} entityType="shot" />
            ))}
          </tbody>
        </table>
      )}

      {showCreateTask && (
        <CreateTaskModal
          entityType="shot"
          entityId={shot.id}
          onClose={() => setShowCreateTask(false)}
        />
      )}
    </div>
  )
}

// =============================================================================
// Modals
// =============================================================================

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [desc, setDesc] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
  })

  return (
    <div className="rw-overlay" onClick={onClose}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}>
        <div className="rw-modal__header">
          <h3 className="rw-modal__title">New Project</h3>
          <button className="rw-modal__close" onClick={onClose}>&times;</button>
        </div>
        <form
          className="rw-modal__body"
          onSubmit={e => {
            e.preventDefault()
            mutation.mutate({ name, code, description: desc || undefined })
          }}
        >
          <div className="rw-form-group">
            <label className="rw-form-label">Name</label>
            <input className="rw-input" value={name} onChange={e => setName(e.target.value)} placeholder="My Film" required />
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Code</label>
            <input className="rw-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="MF" required />
            <span className="rw-form-hint">Short code for URLs and paths</span>
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Description</label>
            <input className="rw-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
          </div>
        </form>
        <div className="rw-modal__footer">
          <button className="rw-btn rw-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="rw-btn rw-btn--primary"
            onClick={() => mutation.mutate({ name, code, description: desc || undefined })}
            disabled={!name || !code || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateAssetModal({ projectCode, onClose }: { projectCode: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('Character')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: { name: string; asset_type: string }) => createAsset(projectCode, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets', projectCode] })
      onClose()
    },
  })

  return (
    <div className="rw-overlay" onClick={onClose}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}>
        <div className="rw-modal__header">
          <h3 className="rw-modal__title">New Asset</h3>
          <button className="rw-modal__close" onClick={onClose}>&times;</button>
        </div>
        <form
          className="rw-modal__body"
          onSubmit={e => {
            e.preventDefault()
            mutation.mutate({ name, asset_type: type })
          }}
        >
          <div className="rw-form-group">
            <label className="rw-form-label">Name</label>
            <input className="rw-input" value={name} onChange={e => setName(e.target.value)} placeholder="hero_dragon" required />
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Type</label>
            <select className="rw-select" value={type} onChange={e => setType(e.target.value)}>
              <option>Character</option>
              <option>Prop</option>
              <option>Environment</option>
              <option>FX</option>
              <option>Vehicle</option>
            </select>
          </div>
        </form>
        <div className="rw-modal__footer">
          <button className="rw-btn rw-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="rw-btn rw-btn--primary"
            onClick={() => mutation.mutate({ name, asset_type: type })}
            disabled={!name || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateShotModal({ projectCode, onClose }: { projectCode: string; onClose: () => void }) {
  const [sequence, setSequence] = useState('')
  const [name, setName] = useState('')
  const [frameStart, setFrameStart] = useState(1001)
  const [frameEnd, setFrameEnd] = useState(1100)
  const [desc, setDesc] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: { sequence: string; name: string; frame_start: number; frame_end: number; description?: string }) =>
      createShot(projectCode, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shots', projectCode] })
      onClose()
    },
  })

  return (
    <div className="rw-overlay" onClick={onClose}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}>
        <div className="rw-modal__header">
          <h3 className="rw-modal__title">New Shot</h3>
          <button className="rw-modal__close" onClick={onClose}>&times;</button>
        </div>
        <form
          className="rw-modal__body"
          onSubmit={e => {
            e.preventDefault()
            mutation.mutate({ sequence, name, frame_start: frameStart, frame_end: frameEnd, description: desc || undefined })
          }}
        >
          <div className="rw-form-group">
            <label className="rw-form-label">Sequence</label>
            <input className="rw-input" value={sequence} onChange={e => setSequence(e.target.value)} placeholder="SEQ010" required />
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Name</label>
            <input className="rw-input" value={name} onChange={e => setName(e.target.value)} placeholder="SH010" required />
          </div>
          <div style={{ display: 'flex', gap: 'var(--rw-space-md)' }}>
            <div className="rw-form-group" style={{ flex: 1 }}>
              <label className="rw-form-label">Frame Start</label>
              <input className="rw-input" type="number" value={frameStart} onChange={e => setFrameStart(Number(e.target.value))} />
            </div>
            <div className="rw-form-group" style={{ flex: 1 }}>
              <label className="rw-form-label">Frame End</label>
              <input className="rw-input" type="number" value={frameEnd} onChange={e => setFrameEnd(Number(e.target.value))} />
            </div>
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Description</label>
            <input className="rw-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
          </div>
        </form>
        <div className="rw-modal__footer">
          <button className="rw-btn rw-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="rw-btn rw-btn--primary"
            onClick={() => mutation.mutate({ sequence, name, frame_start: frameStart, frame_end: frameEnd, description: desc || undefined })}
            disabled={!sequence || !name || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateTaskModal({ entityType, entityId, onClose }: {
  entityType: string
  entityId: number
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState('50')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: { name: string; assignee?: string; priority: number }) =>
      createTaskApi(entityType, entityId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      onClose()
    },
  })

  return (
    <div className="rw-overlay" onClick={onClose}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}>
        <div className="rw-modal__header">
          <h3 className="rw-modal__title">New Task</h3>
          <button className="rw-modal__close" onClick={onClose}>&times;</button>
        </div>
        <form
          className="rw-modal__body"
          onSubmit={e => {
            e.preventDefault()
            mutation.mutate({ name, assignee: assignee || undefined, priority: Number(priority) })
          }}
        >
          <div className="rw-form-group">
            <label className="rw-form-label">Name</label>
            <input className="rw-input" value={name} onChange={e => setName(e.target.value)} placeholder="modeling, rigging, animation..." required />
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Assignee</label>
            <input className="rw-input" value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Artist name" />
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Priority</label>
            <select className="rw-select" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="25">Low</option>
              <option value="50">Medium</option>
              <option value="75">High</option>
            </select>
          </div>
        </form>
        <div className="rw-modal__footer">
          <button className="rw-btn rw-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="rw-btn rw-btn--primary"
            onClick={() => mutation.mutate({ name, assignee: assignee || undefined, priority: Number(priority) })}
            disabled={!name || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateVersionModal({ taskId, onClose }: { taskId: number; onClose: () => void }) {
  const [path, setPath] = useState('')
  const [notes, setNotes] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: { path?: string; notes?: string; created_by?: string }) =>
      createVersion(taskId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['versions', taskId] })
      onClose()
    },
  })

  return (
    <div className="rw-overlay" onClick={onClose}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}>
        <div className="rw-modal__header">
          <h3 className="rw-modal__title">New Version</h3>
          <button className="rw-modal__close" onClick={onClose}>&times;</button>
        </div>
        <form
          className="rw-modal__body"
          onSubmit={e => {
            e.preventDefault()
            mutation.mutate({ path: path || undefined, notes: notes || undefined, created_by: createdBy || undefined })
          }}
        >
          <div className="rw-form-group">
            <label className="rw-form-label">Path</label>
            <input className="rw-input" value={path} onChange={e => setPath(e.target.value)} placeholder="/renders/shot010_comp_v001.exr" />
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Notes</label>
            <textarea className="rw-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What changed in this version?" rows={3} style={{ resize: 'vertical' }} />
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Created By</label>
            <input className="rw-input" value={createdBy} onChange={e => setCreatedBy(e.target.value)} placeholder="Artist name" />
          </div>
        </form>
        <div className="rw-modal__footer">
          <button className="rw-btn rw-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="rw-btn rw-btn--primary"
            onClick={() => mutation.mutate({ path: path || undefined, notes: notes || undefined, created_by: createdBy || undefined })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Publishing...' : 'Publish Version'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Dashboard
// =============================================================================

function Dashboard() {
  const [view, setView] = useState<View>({ page: 'projects' })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentProject = (view.page !== 'projects') ? view.project : null

  const handleNav = (page: string) => {
    setSidebarOpen(false)
    if (page === 'projects') {
      setView({ page: 'projects' })
    } else if (page === 'shots' && currentProject) {
      setView({ page: 'shots', project: currentProject })
    }
  }

  const isActive = (page: string) => {
    if (page === 'projects') return view.page === 'projects' || view.page === 'project' || view.page === 'asset'
    if (page === 'shots') return view.page === 'shots' || view.page === 'shot'
    return false
  }

  return (
    <div className="rw-layout-sidebar">
      {/* Mobile hamburger */}
      <button className="og-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Mobile overlay */}
      <div
        className={`og-mobile-overlay ${sidebarOpen ? 'og-mobile-overlay--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`rw-sidebar ${sidebarOpen ? 'rw-sidebar--open' : ''}`}>
        <div className="rw-sidebar__header">
          <span style={{ fontSize: '1.2rem' }}>&#9889;</span>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--rw-text)' }}>OpenGrid</span>
        </div>

        <div className="rw-sidebar__section">
          <div className="rw-sidebar__section-title">Production</div>
          <div
            className={`rw-sidebar__link ${isActive('projects') ? 'rw-sidebar__link--active' : ''}`}
            onClick={() => handleNav('projects')}
          >
            Projects
          </div>
          <div
            className={`rw-sidebar__link ${isActive('shots') ? 'rw-sidebar__link--active' : ''}`}
            onClick={() => {
              if (currentProject) {
                handleNav('shots')
              }
            }}
            style={!currentProject ? { opacity: 0.5 } : undefined}
            title={!currentProject ? 'Select a project first' : undefined}
          >
            Shots
          </div>
          <div
            className="rw-sidebar__link"
            style={{ opacity: 0.5 }}
          >
            My Tasks
          </div>
        </div>

        {currentProject && (
          <div className="rw-sidebar__section">
            <div className="rw-sidebar__section-title">Current Project</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--rw-text)', padding: '0 var(--rw-space-sm)' }}>
              {currentProject.name}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', fontSize: '0.7rem', color: 'var(--rw-text-muted)' }}>
          OpenGrid v0.1.0
        </div>
      </aside>

      <main className="rw-layout-sidebar__content">
        {view.page === 'projects' && (
          <ProjectsView
            onSelect={p => setView({ page: 'project', project: p })}
          />
        )}
        {view.page === 'project' && (
          <ProjectDetailView
            project={view.project}
            onSelectAsset={a => setView({ page: 'asset', project: view.project, asset: a })}
            onBack={() => setView({ page: 'projects' })}
          />
        )}
        {view.page === 'asset' && (
          <AssetDetailView
            project={view.project}
            asset={view.asset}
            onBack={() => setView({ page: 'project', project: view.project })}
          />
        )}
        {view.page === 'shots' && (
          <ShotsView
            project={view.project}
            onSelectShot={s => setView({ page: 'shot', project: view.project, shot: s })}
            onBack={() => setView({ page: 'project', project: view.project })}
          />
        )}
        {view.page === 'shot' && (
          <ShotDetailView
            project={view.project}
            shot={view.shot}
            onBack={() => setView({ page: 'shots', project: view.project })}
          />
        )}
      </main>
    </div>
  )
}

// =============================================================================
// Root
// =============================================================================

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}
