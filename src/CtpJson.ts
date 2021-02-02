import * as inquirer from 'inquirer'

/**
 * Input type.
 */
export type Input = string | inquirer.QuestionCollection

/**
 * CtpJson type.
 */
export type CtpJson = {
  inputs?: Input[]
  replaces?: string[]
  hooks?: {
    created?: string | string[]
  }
}
