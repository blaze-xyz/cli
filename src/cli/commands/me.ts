import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerMeCommands(program: Command): void {
  const me = program.command("me").description("View and update your profile")

  me.command("show")
    .description("Show your profile")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const profile = await client.getMe()
        formatOutput(profile, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  me.command("blazetag <tag>")
    .description("Set your Blaze tag")
    .action(async (tag: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.setBlazetag(tag)
        formatOutput(result, globals.format)
        console.log(`Blaze tag set to @${tag}.`)
      } catch (err) {
        handleError(err)
      }
    })
}
