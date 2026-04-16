# Integration Story: TanStack Router and TanStack React Query

> what's the typical essential pattern for making coordinated usage of these two things in a way that makes rendering as efficient as possible?

The usual pattern is not “router owns route data, hooks own live data” as two competing systems; it is “router preloads/co-ordinates, React Query stores/subscribes/refetches.” TanStack Router’s own docs explicitly frame the router as a **coordinator** for external caches, and the canonical integration is: **loader seeds the Query cache, component reads the same query via `useSuspenseQuery`/`useQuery`**. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)

## Core pattern

For critical render data, put `queryClient.ensureQueryData(queryOptions)` in the route loader so the cache is warm before the route renders, then call `useSuspenseQuery(queryOptions)` in the route component or its children to read that same cache entry and subscribe to updates. This avoids loading flashes and waterfalls while still letting React Query handle background refetching, invalidation, stale logic, and fine-grained re-renders at the component level. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/)

A representative shape is:

```ts
const postsQuery = queryOptions({
  queryKey: ['posts'],
  queryFn: fetchPosts,
})

export const Route = createFileRoute('/posts')({
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: PostsPage,
})

function PostsPage() {
  const { data } = useSuspenseQuery(postsQuery)
  return <PostsList posts={data} />
}
```

That pattern is shown directly in the TanStack docs. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)

## Your concern about rerenders

Your intuition is mostly right: loaders are best for **navigation-time readiness**, not for every ongoing freshness event while the user sits on the page. The docs’ integration pattern is designed so that after the loader has ensured data exists, the component tree reads through React Query hooks, and those hooks can refetch/update without requiring you to drive everything back through a route reload. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/)

More importantly, React Query updates are tied to the subscribed query observers, so in the normal pattern you do **not** use loader reruns as the primary mechanism for “data changed while I’m on this route.” Instead, let query invalidation, `refetch`, stale-time behavior, mutations, and selective hook placement control what rerenders. [tanstack](https://tanstack.com/router/v1/docs/framework/react/examples/basic-react-query)

## Division of responsibilities

| Concern | Typical owner |
|---|---|
| Ensure route-critical data is present before render | Route loader with `ensureQueryData`. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/) |
| Prevent waterfalls on navigation/preload | Router loader/preloading. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/) |
| Cache, freshness, background refetch, invalidation | React Query. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/) |
| Fine-grained subscriptions inside the page | `useQuery` / `useSuspenseQuery` in the components that need data. [tanstack](https://tanstack.com/router/latest/docs/integrations/query) |
| “Reload whole route because route inputs changed” | Router invalidation / navigation-triggered loader rerun. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/) |

That is the essential integration story the docs push: the router gets data ready at the right navigation moment, while Query remains the source of truth for ongoing client-side data lifecycle. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)

## Efficient rendering pattern

A good default architecture is:

- Put **route-critical** queries in loaders with `ensureQueryData`. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/)
- In the rendered route, consume those queries via `useSuspenseQuery` close to where they are needed, not all at the page root, so only relevant subtrees rerender when query data changes. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)
- Put **secondary / below-the-fold / user-triggered** data behind component-level `useQuery` hooks, often non-suspense if they are not required for first paint. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)
- After mutations, invalidate the specific query keys rather than invalidating the whole router, unless route-level dependencies genuinely changed. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/)

That last point matters: `router.invalidate()` exists and is appropriate for retrying/reloading route loaders, especially in route error flows, but it is broader than invalidating one or two query keys, so it is usually not your first tool for routine in-page freshness. [tanstack](https://tanstack.com/router/v1/docs/framework/react/examples/basic-react-query)

## When to use loader data vs hook-only data

Use a loader when the user experience depends on having that data ready *as part of entering the route*—for example the main entity for `/posts/$postId`, auth/permission checks, or data needed to decide redirects. Use plain query hooks for data that can appear after first paint, refresh in the background, or update frequently without being fundamental to route entry. [tanstack](https://tanstack.com/router/v1/docs/framework/react/examples/basic-react-query)

The docs also distinguish `useSuspenseQuery` from `useQuery`: with the SSR integration, `useSuspenseQuery` participates in server rendering and streaming, while plain `useQuery` runs on the client after hydration, making it a better fit for non-critical data. So the practical split is often: **loader + suspense for critical route data, hook-only non-suspense for ancillary live data**. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)

## About “full page rerender”

If you wire everything through a top-level route component that reads one giant query result and then passes props downward, you can indeed create coarse rerender behavior—but that is not a loader problem so much as a subscription-placement problem. The efficient pattern is to keep the loader only as cache priming, then place separate query hooks in smaller leaf components or use multiple queries keyed by concern so that Query’s observer model can rerender only affected parts. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/)

So the real anti-pattern is:

- Loader fetches everything.
- Route component reads everything at the top.
- Every mutation causes global route invalidation.

A better pattern is:

- Loader primes only the route-critical queries.
- Components subscribe only to the slices they need.
- Mutations invalidate targeted keys.
- Route invalidation is reserved for actual route-level dependency changes or recovery flows. [tanstack](https://tanstack.com/router/v1/docs/framework/react/examples/basic-react-query)

## A practical mental model

Think of TanStack Router as deciding **when the app should be ready**, and TanStack Query as deciding **what is fresh and who should update**. If you use the loader mainly to guarantee initial readiness and the query hooks for all subsequent observation and invalidation, the two libraries stop feeling redundant and start fitting together cleanly. [frontendmasters](https://frontendmasters.com/blog/tanstack-router-data-loading-2/)

## What I’d recommend by default

For most apps, this is the best baseline:

- One shared `queryOptions(...)` factory per resource/query shape. [tanstack](https://tanstack.com/router/v1/docs/framework/react/examples/basic-react-query)
- Route loader calls `ensureQueryData` for only the data needed to render the route’s first meaningful view. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)
- Components call `useSuspenseQuery` for those preloaded queries. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)
- Child widgets use their own `useQuery` hooks for secondary/live data. [tanstack](https://tanstack.com/router/latest/docs/integrations/query)
- Mutations call `queryClient.invalidateQueries(...)` on precise keys; avoid `router.invalidate()` except when route loaders themselves must rerun. [tanstack](https://tanstack.com/router/v1/docs/framework/react/examples/basic-react-query)
