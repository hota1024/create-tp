import * as path from 'path'
import * as fs from 'fs-extra'
import { Stream } from 'stream'
import { Command, flags } from '@oclif/command'
import { Octokit } from '@octokit/rest'
import * as inquirer from 'inquirer'
import cli from 'cli-ux'
import * as cliProgress from 'cli-progress'
import axios from 'axios'
import * as compressing from 'compressing'
import chalk = require('chalk')

class CreateTp extends Command {
  static description = 'create typescript package'

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    clone: flags.boolean({ char: 'c' }),
    list: flags.boolean({ char: 'l', default: false }),
  }

  static args = [{ name: 'name' }]

  async run(): Promise<void> {
    const { args, flags } = this.parse(CreateTp)

    if (flags.list) {
      const configDir = path.join(this.config.configDir)
      const templatesDir = this.getTemplatesPath(configDir)
      const cachedTemplates = await fs.readdir(templatesDir)

      this.log(`${chalk.green`templates path:`} ${templatesDir}`)
      this.log(chalk.green`templates`)
      for (const path of cachedTemplates) {
        this.log(`${chalk.gray`-`} ${path}`)
      }
      return
    }

    const name = args.name || (await this.promptName())
    const description = await this.promptDescription()
    const license = await this.promptLicense()

    const packagePath = path.join(process.cwd(), name)

    const template = await this.getTemplateData(
      'hota1024',
      'npm-package-template'
    )
    const configDir = path.join(this.config.configDir)
    await this.makeConfigDirIfNotExists(configDir)

    const cachedTemplates = await fs.readdir(this.getTemplatesPath(configDir))
    const templateZip = `${template.id}.zip`
    const templatePath = path.join(
      this.getTemplatesPath(configDir),
      `${template.id}.zip`
    )

    if (cachedTemplates.includes(templateZip) && !flags.clone) {
      console.log(cachedTemplates)
    } else {
      cli.action.start(`downloading latest template`)
      const { data: stream } = await axios.get<Stream>(template.cloneUrl, {
        responseType: 'stream',
      })
      stream.pipe(fs.createWriteStream(templatePath))
      cli.action.stop()
    }

    const tmpPath = `${packagePath}-${Math.floor(Math.random() * 1000000)}`
    await compressing.zip.uncompress(templatePath, tmpPath)
    const [outDir] = await fs.readdir(tmpPath)
    await fs.move(path.join(tmpPath, outDir), packagePath)
    await fs.remove(tmpPath)

    const transformFiles = ['package.json', 'README.md']
    for (const file of transformFiles) {
      const filePath = path.join(packagePath, file)

      const content = await fs.readFile(filePath)
      const transformed = content
        .toString()
        .replace('{packageName}', name)
        .replace('{description}', description)
        .replace('{license}', license)

      await fs.writeFile(filePath, transformed)
    }
  }

  parseTemplateId(id: string): { dir: string; time: number } {
    const matches = id.match(/^(.+)-(\d+)$/)

    if (!matches) {
      this.error(`invalid id '${id}'`)
    }

    return {
      dir: matches[1],
      time: parseInt(matches[2]),
    }
  }

  async makeConfigDirIfNotExists(configDir: string): Promise<void> {
    if (await fs.pathExists(configDir)) {
      return
    }

    await fs.mkdir(configDir)
    await fs.mkdir(this.getTemplatesPath(configDir))
  }

  getTemplatesPath(configPath: string): string {
    return path.join(configPath, 'templates')
  }

  async getTemplateData(
    owner: string,
    repo: string
  ): Promise<{ id: string; cloneUrl: string; pushedAt: number }> {
    const octkit = new Octokit()
    const { data: templateData } = await octkit.request(
      'GET /repos/{owner}/{repo}',
      {
        owner,
        repo,
      }
    )
    const cloneUrl = `${templateData.html_url}/archive/master.zip`
    const pushedAt = new Date(templateData.pushed_at).getTime()

    return {
      id: `${owner}-${repo}-${pushedAt}`,
      cloneUrl,
      pushedAt,
    }
  }

  promptLicense(): Promise<string> {
    return inquirer
      .prompt<{ license: string }>([
        {
          name: 'license',
          message: 'package license',
          type: 'input',
          default: 'MIT',
        },
      ])
      .then(({ license }) => license)
  }

  promptDescription(): Promise<string> {
    return inquirer
      .prompt<{ description: string }>([
        {
          name: 'description',
          message: 'package description',
          type: 'input',
        },
      ])
      .then(({ description }) => description)
  }

  promptName(): Promise<string> {
    return inquirer
      .prompt<{ name: string }>([
        {
          name: 'name',
          message: 'package name',
          type: 'input',
          validate: (v) => !!v || 'required',
        },
      ])
      .then(({ name }) => name)
  }
}

export = CreateTp
