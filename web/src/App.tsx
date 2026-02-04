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

interface Task {
  id: number
  entity_type: string
  entity_id: number
  name: string
  status: string
  assignee?: string
  priority: number
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

async function fetchTasks(assetId: number): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/tasks`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
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
  }
  return map[status] || ''
}

// =============================================================================
// Views
// =============================================================================

type View =
  | { page: 'projects' }
  | { page: 'project'; project: Project }
  | { page: 'asset'; project: Project; asset: Asset }

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
// Asset Detail (tasks)
// =============================================================================

function AssetDetailView({ project, asset, onBack }: {
  project: Project
  asset: Asset
  onBack: () => void
}) {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', asset.id],
    queryFn: () => fetchTasks(asset.id),
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
              <tr key={task.id}>
                <td>{task.name}</td>
                <td>{task.assignee || '—'}</td>
                <td>{task.priority}</td>
                <td>
                  <span className={`rw-badge rw-badge--sm ${statusBadge(task.status)}`}>
                    {task.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

// =============================================================================
// Dashboard
// =============================================================================

function Dashboard() {
  const [view, setView] = useState<View>({ page: 'projects' })

  const navItems = [
    { label: 'Projects', active: true },
    { label: 'Shots', active: false },
    { label: 'My Tasks', active: false },
  ]

  return (
    <div className="rw-layout-sidebar">
      <aside className="rw-sidebar">
        <div className="rw-sidebar__header">
          <span style={{ fontSize: '1.2rem' }}>&#9889;</span>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--rw-text)' }}>OpenGrid</span>
        </div>

        <div className="rw-sidebar__section">
          <div className="rw-sidebar__section-title">Production</div>
          {navItems.map(item => (
            <div
              key={item.label}
              className={`rw-sidebar__link ${item.active ? 'rw-sidebar__link--active' : ''}`}
              onClick={() => item.active && setView({ page: 'projects' })}
              style={!item.active ? { opacity: 0.5 } : undefined}
            >
              {item.label}
            </div>
          ))}
        </div>

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
