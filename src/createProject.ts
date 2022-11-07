import { Octokit } from '@octokit/rest'
import chalk = require('chalk')
import * as fs from 'fs-extra'
import * as compressing from 'compressing'
import * as inquirer from 'inquirer'
import * as npath from 'path'
import * as glob from 'glob'
import * as changecase from 'change-case'
import { spawn } from 'child_process'
import cli from 'cli-ux'
import {
  getTemplatePath,
  parseRepositoryPath,
  pathToId,
  RepositoryPathInfo,
} from './helpers'
import { CtpJson } from './CtpJson'

/**
 * create project.
 */
export const createProject = async (
  templateRepository: string,
  name?: string
): Promise<string | void> => {
  const repositoryPath = parseRepositoryPath(templateRepository)
  const id = pathToId(repositoryPath)
  const octokit = new Octokit()

  try {
    cli.action.start(chalk.cyan`⬇️  fetching latest template information`)
    const { data: repository } = await octokit.request(
      'GET /repos/{owner}/{repo}',
      repositoryPath
    )
    cli.action.stop()

    const timestamp = await getTimestamp(id)

    if (timestamp) {
      if (new Date(repository.updated_at).getTime() > timestamp) {
        await download(repositoryPath, repository.default_branch)
      }
    } else {
      await download(repositoryPath, repository.default_branch)
    }
  } catch (e) {
    cli.action.stop()
    console.log(
      chalk.red`❗ failed to retrieve the template information because there is no Internet connection`
    )

    if (!(await fs.pathExists(getTemplatePath(id)))) {
      console.log(
        chalk.red`❗ the template has not been downloaded locally. please connect to the Internet and try again.`
      )

      return undefined
    } else {
      console.log(chalk.cyan`ℹ️  load the template from local.`)
    }
  }

  return await setupProject(repositoryPath, name)
}

const getTimestamp = async (id: string): Promise<number | false> => {
  const timestampPath = getTemplatePath(id, '.timestamp')
  const exists = await fs.pathExists(timestampPath)

  if (exists) {
    const buffer = await fs.readFile(timestampPath)
    const timestamp = parseInt(buffer.toString())

    return timestamp
  }

  return false
}

const download = async (
  path: RepositoryPathInfo,
  ref: string
): Promise<void> => {
  cli.action.start(chalk.cyan`⬇️  fetching the latest template`)

  const octokit = new Octokit()

  const { data: repository } = await octokit.request(
    'GET /repos/{owner}/{repo}',
    path
  )

  const { data } = await octokit.request(
    'GET /repos/{owner}/{repo}/zipball/{ref}',
    {
      ...path,
      ref,
    }
  )

  const id = pathToId(path)
  const templatePath = getTemplatePath(id)
  const buffer = Buffer.from(data as ArrayBuffer)

  if (await fs.pathExists(templatePath)) {
    await fs.remove(templatePath)
  }

  await fs.mkdirs(templatePath)
  await compressing.zip.uncompress(buffer, templatePath)

  const files = await fs.readdir(templatePath)
  const dest = getTemplatePath(id, files[0])

  await fs.copy(dest, templatePath)
  await fs.remove(dest)

  const timestamp = new Date(repository.updated_at).getTime()
  await fs.writeFile(getTemplatePath(id, '.timestamp'), timestamp.toString())

  cli.action.stop()
}

const setupProject = async (
  path: RepositoryPathInfo,
  name?: string
): Promise<string> => {
  const id = pathToId(path)
  const ctpJson = await getCptJson(getTemplatePath(id, 'ctp.json'))

  const questions: inquirer.QuestionCollection[] = []

  for (const input of ctpJson.inputs ?? []) {
    if (
      name &&
      (input === 'name' || (input as { name: string }).name === 'name')
    ) {
      continue
    }

    if (typeof input === 'string') {
      if (input === 'name') {
        questions.push({
          type: 'input',
          name: input,
          validate: (v) => !!v || 'required',
        })
      } else {
        questions.push({
          type: 'input',
          name: input,
        })
      }
    } else if ((input as { name: string }).name === 'name') {
      questions.push({
        ...input,
        validate: (v) => !!v || 'required',
      })
    } else {
      questions.push({
        ...input,
        validate: (input as { required?: boolean }).required
          ? (v) => !!v || 'required'
          : undefined,
      })
    }
  }

  const data = await inquirer.prompt(questions)
  data.name = data.name ?? name
  const projectName: string = data.name

  const templatePath = getTemplatePath(id)
  const projectPath = npath.join(process.cwd(), projectName)

  cli.action.start(chalk.cyan`➡️  copying template for project`)
  await fs.copy(templatePath, projectPath)
  await Promise.all([
    fs.remove(npath.join(projectPath, '.timestamp')),
    fs.remove(npath.join(projectPath, 'ctp.json')),
  ])
  cli.action.stop()

  if (ctpJson.replaces && ctpJson.replaces.length > 0) {
    console.log()
    cli.action.start(chalk.cyan`🔁 replacing project files`)
    for (const replace of ctpJson.replaces) {
      const paths = glob.sync(npath.join(projectPath, replace))

      for (const path of paths) {
        for (const [key, value] of Object.entries(data)) {
          const buffer = await fs.readFile(path)
          let content = buffer.toString()

          const cases = {
            camel: changecase.camelCase(value),
            capital: changecase.capitalCase(value),
            constant: changecase.constantCase(value),
            dot: changecase.dotCase(value),
            header: changecase.headerCase(value),
            no: changecase.noCase(value),
            param: changecase.paramCase(value),
            pascal: changecase.pascalCase(value),
            pathCase: changecase.pathCase(value),
            sentence: changecase.sentenceCase(value),
            snake: changecase.snakeCase(value),
          }

          if (npath.extname(path).match(/\.(j|t)sx?$/)) {
            for (const [caseName, caseString] of Object.entries(cases)) {
              content = content.replaceAll(
                `__ctp__${key}_${caseName}`,
                caseString
              )
            }

            content = content.replaceAll(`__ctp__${key}`, value)
          } else {
            for (const [caseName, caseString] of Object.entries(cases)) {
              content = content.replaceAll(`{${key}.${caseName}}`, caseString)
              content = content.replaceAll(
                `--ctp--${key}.${caseName}`,
                caseString
              )
            }

            content = content.replaceAll(`{${key}}`, value)
            content = content.replaceAll(`--ctp--${key}`, value)
          }

          await fs.writeFile(path, content)
        }
      }
    }
    cli.action.stop()
  }

  if (ctpJson?.hooks?.created) {
    console.log()

    const commands =
      typeof ctpJson.hooks.created === 'string'
        ? [ctpJson.hooks.created]
        : ctpJson.hooks.created

    for (const command of commands) {
      const matches = command.match(/"[^"]+"|'[^']+'|\S+/g)
      if (!matches) {
        continue
      }

      await new Promise((resolve) => {
        const p = spawn(matches[0], matches.slice(1), {
          cwd: projectPath,
          stdio: 'inherit',
        })

        p.on('exit', resolve)
      })
    }
  }

  console.log()
  console.log(
    chalk.green`🤩 successfully created the project! have fun coding!`
  )
  console.log()
  console.log(`project path: ${chalk.cyan(projectPath)}`)
  console.log()

  return projectPath
}

const getCptJson = async (path: string): Promise<CtpJson> => {
  const buffer = await fs.readFile(path)

  return JSON.parse(buffer.toString())
}
