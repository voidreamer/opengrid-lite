import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient()
const API_BASE = 'http://localhost:8000/api'

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

async function createProject(data: { name: string; code: string }): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create project')
  return res.json()
}

// =============================================================================
// Components
// =============================================================================

function ProjectList({ onSelect }: { onSelect: (p: Project) => void }) {
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  if (isLoading) return <div className="rw-skeleton rw-skeleton--card" />
  if (error) return <div className="rw-badge rw-badge--danger">Error loading projects</div>

  return (
    <div className="rw-stack">
      <h3 className="rw-h4">Projects</h3>
      {projects?.length === 0 && (
        <p className="rw-text-muted">No projects yet. Create one!</p>
      )}
      {projects?.map(project => (
        <div
          key={project.id}
          className="rw-card rw-card--interactive"
          onClick={() => onSelect(project)}
        >
          <div className="rw-card__header">
            <span className="rw-card__title">{project.name}</span>
            <span className="rw-badge">{project.code}</span>
          </div>
          {project.description && (
            <p className="rw-card__body rw-text-sm">{project.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function AssetList({ project, onSelect }: { project: Project; onSelect: (a: Asset) => void }) {
  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets', project.code],
    queryFn: () => fetchAssets(project.code),
  })

  if (isLoading) return <div className="rw-skeleton rw-skeleton--card" />

  return (
    <div className="rw-stack">
      <div className="rw-flex rw-flex--between rw-flex--align-center">
        <h3 className="rw-h4">Assets — {project.name}</h3>
        <span className="rw-badge rw-badge--accent">{assets?.length || 0} assets</span>
      </div>
      {assets?.length === 0 && (
        <p className="rw-text-muted">No assets in this project.</p>
      )}
      <div className="rw-grid rw-grid--auto-sm">
        {assets?.map(asset => (
          <div
            key={asset.id}
            className="rw-card rw-card--interactive rw-card--compact"
            onClick={() => onSelect(asset)}
          >
            <div className="rw-flex rw-flex--between rw-flex--align-center">
              <span className="rw-text-accent" style={{ fontWeight: 600 }}>{asset.name}</span>
              <span className="rw-badge rw-badge--sm">{asset.asset_type}</span>
            </div>
            <div className="rw-mt-sm">
              <span className={`rw-badge rw-badge--sm ${statusClass(asset.status)}`}>
                {asset.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskList({ asset }: { asset: Asset }) {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', asset.id],
    queryFn: () => fetchTasks(asset.id),
  })

  if (isLoading) return <div className="rw-skeleton rw-skeleton--card" />

  return (
    <div className="rw-stack">
      <h3 className="rw-h4">Tasks — {asset.name}</h3>
      {tasks?.length === 0 && (
        <p className="rw-text-muted">No tasks on this asset.</p>
      )}
      {tasks?.map(task => (
        <div key={task.id} className="rw-card rw-card--compact">
          <div className="rw-flex rw-flex--between rw-flex--align-center">
            <span style={{ fontWeight: 600 }}>{task.name}</span>
            <span className={`rw-badge rw-badge--sm ${statusClass(task.status)}`}>
              {task.status}
            </span>
          </div>
          {task.assignee && (
            <p className="rw-text-sm rw-text-secondary rw-mt-sm">
              Assigned to: {task.assignee}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const queryClient = useQueryClient()
  
  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
  })

  return (
    <div className="rw-overlay" onClick={onClose}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}>
        <div className="rw-modal__header">
          <h3 className="rw-modal__title">Create Project</h3>
          <button className="rw-modal__close" onClick={onClose}>×</button>
        </div>
        <form
          className="rw-modal__body"
          onSubmit={e => {
            e.preventDefault()
            mutation.mutate({ name, code })
          }}
        >
          <div className="rw-form-group">
            <label className="rw-form-label">Project Name</label>
            <input
              className="rw-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Awesome Film"
              required
            />
          </div>
          <div className="rw-form-group">
            <label className="rw-form-label">Project Code</label>
            <input
              className="rw-input"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="MAF"
              required
            />
            <span className="rw-form-hint">Short code for URLs and paths</span>
          </div>
        </form>
        <div className="rw-modal__footer">
          <button className="rw-btn rw-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="rw-btn rw-btn--primary"
            onClick={() => mutation.mutate({ name, code })}
            disabled={!name || !code || mutation.isPending}
          >
            {mutation.isPending ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

function statusClass(status: string): string {
  switch (status) {
    case 'approved':
    case 'complete':
      return 'rw-badge--success'
    case 'in_progress':
      return 'rw-badge--info'
    case 'review':
      return 'rw-badge--warning'
    case 'waiting':
    case 'on_hold':
      return ''
    default:
      return ''
  }
}

// =============================================================================
// Main App
// =============================================================================

function Dashboard() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)

  return (
    <div className="rw-layout-sidebar">
      <aside className="rw-sidebar">
        <div className="rw-sidebar__header">
          <div className="rw-navbar__logo">⚡</div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>OpenGrid</span>
        </div>
        
        <div className="rw-sidebar__section">
          <div className="rw-sidebar__section-title">Navigation</div>
          <a href="#" className="rw-sidebar__link rw-sidebar__link--active">
            📁 Projects
          </a>
          <a href="#" className="rw-sidebar__link">
            🎬 Shots
          </a>
          <a href="#" className="rw-sidebar__link">
            👤 My Tasks
          </a>
        </div>
        
        <div style={{ marginTop: 'auto', padding: '1rem 0' }}>
          <button
            className="rw-btn rw-btn--primary rw-btn--block"
            onClick={() => setShowCreateProject(true)}
          >
            + New Project
          </button>
        </div>
      </aside>
      
      <main className="rw-layout-sidebar__content">
        <div className="rw-grid rw-grid--3" style={{ gap: '2rem' }}>
          <div>
            <ProjectList onSelect={p => { setSelectedProject(p); setSelectedAsset(null) }} />
          </div>
          <div>
            {selectedProject && (
              <AssetList project={selectedProject} onSelect={setSelectedAsset} />
            )}
          </div>
          <div>
            {selectedAsset && <TaskList asset={selectedAsset} />}
          </div>
        </div>
      </main>
      
      {showCreateProject && (
        <CreateProjectModal onClose={() => setShowCreateProject(false)} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}
