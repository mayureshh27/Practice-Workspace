import { queryOptions } from '@tanstack/react-query'
import { api } from './workspaceApi'

export const domainQueries = {
  list: () => queryOptions({
    queryKey: ['domains'],
    queryFn: api.getDomains,
    staleTime: 1000 * 60 * 5,
  }),
  detail: (id: string) => queryOptions({
    queryKey: ['domains', id],
    queryFn: () => api.getDomain(id),
    staleTime: 1000 * 60 * 5,
  }),
}

export const problemsQueries = {
  catalog: () => queryOptions({
    queryKey: ['problems'],
    queryFn: async () => {
      const { API } = await import('../problemContent')
      const res = await fetch(`${API}/api/problems`)
      if (!res.ok) throw new Error('Failed to fetch problems')
      return res.json()
    },
    staleTime: 1000 * 60 * 30,
  }),
}

export const masteryQueries = {
  scores: () => queryOptions({
    queryKey: ['mastery', 'scores'],
    queryFn: api.getMasteryScores,
    staleTime: 1000 * 30,
  }),
  blindSpots: () => queryOptions({
    queryKey: ['mastery', 'blind-spots'],
    queryFn: api.getBlindSpots,
    staleTime: 1000 * 60,
  }),
}

export const sourcesQueries = {
  list: () => queryOptions({
    queryKey: ['sources'],
    queryFn: api.getSources,
    staleTime: 1000 * 60 * 30,
  }),
}

export const artifactsQueries = {
  list: () => queryOptions({
    queryKey: ['artifacts'],
    queryFn: api.getArtifacts,
    staleTime: 1000 * 60 * 5,
  }),
}

export const conceptQueries = {
  graph: () => queryOptions({
    queryKey: ['concepts', 'graph'],
    queryFn: api.getConceptGraph,
    staleTime: 1000 * 60 * 2,
  }),
}
