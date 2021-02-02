import * as path from 'path'

/**
 * RepositoryPathInfo type.
 */
export type RepositoryPathInfo = {
  owner: string
  repo: string
}

/**
 * parse repository path.
 */
export const parseRepositoryPath = (path: string): RepositoryPathInfo => {
  const matches = path.match(/^(.+)\/(.+)$/)

  if (!matches) {
    throw new Error(`"${path}" is not a repository path.`)
  }

  return {
    owner: matches[1],
    repo: matches[2],
  }
}

/**
 * get template path.
 */
export const getTemplatePath = (id = '', ...paths: string[]): string =>
  path.join(__dirname, '../templates', id, ...paths)

/**
 * repository path to id string.
 */
export const pathToId = (path: RepositoryPathInfo): string =>
  `${path.owner}-${path.repo}`
