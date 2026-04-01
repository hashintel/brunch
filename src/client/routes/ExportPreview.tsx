import { useParams, Link } from '@tanstack/react-router';

export function ExportPreview() {
	const { id } = useParams({ from: '/project/$id/export' });

	return (
		<div style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
			<Link to="/project/$id" params={{ id }} style={{ textDecoration: 'none', fontSize: 14 }}>
				&larr; Back to project
			</Link>
			<h1>Export Preview</h1>
			<p style={{ color: '#666' }}>Export coming soon.</p>
		</div>
	);
}
