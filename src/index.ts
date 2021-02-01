import { Command, flags } from '@oclif/command'

class CreateTp extends Command {
  static description = 'create typescript package'

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    lib: flags.boolean({ char: 'l' }),
  }

  static args = [{ name: 'name' }]

  async run(): Promise<void> {
    const { args, flags } = this.parse(CreateTp)
  }
}

export = CreateTp
