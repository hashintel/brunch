import { useLoaderData, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Brunch</h1>
      <p className="mt-1 text-muted-foreground">AI-guided spec elicitation</p>

      <Button onClick={handleCreate} disabled={creating} className="mt-6 mb-6">
        {creating ? 'Creating...' : 'New project'}
      </Button>

      {projects.length === 0 ? (
        <p className="text-muted-foreground">No projects yet. Create one to get started.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate({ to: '/project/$id', params: { id: String(p.id) } })}
            >
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>Created: {new Date(p.created_at).toLocaleDateString()}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
