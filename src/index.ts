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
    templateRepository: flags.string({ char: 't' }),
  }

  static args = [{ name: 'name' }]

  static projectTemplateRepository = 'hota1024/npm-package-template'

  static libraryTemplateRepository = 'hota1024/npm-package-template'

  async run(): Promise<void> {
    const { args, flags } = this.parse(CreateTp)

    const path = await this.createProject(
      flags.templateRepository || flags.lib
        ? CreateTp.libraryTemplateRepository
        : CreateTp.projectTemplateRepository,
      args.name
    )

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
