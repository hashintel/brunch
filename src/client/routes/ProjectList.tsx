import { useLoaderData, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export function ProjectList() {
  const projects = useLoaderData({ from: '/' });
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const name = prompt('Project name:');
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const project = await res.json();
      void navigate({ to: '/project/$id', params: { id: String(project.id) } });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1>Brunch</h1>
      <p>AI-guided spec elicitation</p>

      <button
        onClick={handleCreate}
        disabled={creating}
        style={{ marginBottom: 24, padding: '8px 16px', fontSize: 14 }}
      >
        {creating ? 'Creating...' : 'New project'}
      </button>

      {projects.length === 0 ? (
        <p style={{ color: '#666' }}>No projects yet. Create one to get started.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {projects.map((p) => (
            <li
              key={p.id}
              onClick={() => navigate({ to: '/project/$id', params: { id: String(p.id) } })}
              style={{
                padding: 16,
                marginBottom: 8,
                border: '1px solid #ddd',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <strong>{p.name}</strong>
              <br />
              <small style={{ color: '#888' }}>Created: {new Date(p.created_at).toLocaleDateString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
