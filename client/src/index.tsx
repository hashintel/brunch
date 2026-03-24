import { LocationProvider, Router, Route, useLocation, hydrate, prerender as ssr } from 'preact-iso';

import { Header } from './components/Header.js';
import { Home } from './pages/Home';
import { CreateSpec } from './pages/CreateSpec';
import { NotFound } from './pages/_404.js';
import './style.css';

function AppInner() {
	const { url } = useLocation();
	const hideHeader = url.startsWith('/create-spec');

	return (
		<>
			{!hideHeader && <Header />}
			<main>
				<Router>
					<Route path="/" component={Home} />
					<Route path="/session/:id" component={Home} />
					<Route path="/create-spec" component={CreateSpec} />
					<Route default component={NotFound} />
				</Router>
			</main>
		</>
	);
}

export function App() {
	return (
		<LocationProvider>
			<AppInner />
		</LocationProvider>
	);
}

if (typeof window !== 'undefined') {
	hydrate(<App />, document.getElementById('app'));
}

export async function prerender(data) {
	return await ssr(<App {...data} />);
}
