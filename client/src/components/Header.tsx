import { useLocation } from 'preact-iso';

export function Header() {
	const { url } = useLocation();

	return (
		<header>
            {/*<h1 style={{color: 'white'}}>.</h1>*/}
            {/*<span>Hash</span>*/}
			{/*<nav>*/}
			{/*	<a href="/" class={url == '/' && 'active'}>*/}
			{/*		Home*/}
			{/*	</a>*/}
			{/*	<a href="/404" class={url == '/404' && 'active'}>*/}
			{/*		404*/}
			{/*	</a>*/}
            {/*    <a href="/about" class={url == '/about' && 'active'}>*/}
            {/*        About*/}
            {/*    </a>*/}
			{/*</nav>*/}
		</header>
	);
}
