import { Command, flags } from '@oclif/command'
import { exec } from 'child_process'
import { createProject } from './createProject'

class CreateTp extends Command {
  static description = 'create typescript package'

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    lib: flags.boolean({ char: 'l' }),
    code: flags.boolean({ char: 'c' }),
    template: flags.string({
      char: 't',
      options: ['project', 'lib', 'reactlib', 'next', 'nest', 'next-material'],
    }),
    repo: flags.string({ char: 'r' }),
  }

  static args = [{ name: 'name' }]

  static templates = {
    project: 'hota1024/npm-package-template',
    reactlib: 'hota1024/react-library-template',
    lib: 'hota1024/npm-package-template',
    next: 'hota1024/next-app-template',
    nest: 'hota1024/nest-app-template',
    'next-material': 'hota1024/next-material-ui-template',
  }

  async run(): Promise<void> {
    const { args, flags } = this.parse(CreateTp)

    let templateRepository = ''

    if (flags.repo) {
      templateRepository = flags.repo
    } else if (flags.template) {
      templateRepository = (CreateTp.templates as { [k: string]: string })[
        flags.template
      ]
      if (!templateRepository) {
        this.error(`${flags.template} is not a template name`)
      }
    } else if (flags.lib) {
      templateRepository = CreateTp.templates.lib
    } else {
      templateRepository = CreateTp.templates.project
    }

    const path = await this.createProject(templateRepository, args.name)

    if (path) {
      if (flags.code) {
        exec(`code "${path}"`)
      }
    }
  }

  private async createProject(
    templateRepository: string,
    name?: string
  ): Promise<string | void> {
    return createProject(templateRepository, name)
  }
}

export = CreateTp
