import { Command } from "commander"
import { getClient, getGlobalOpts, handleError, withSpinner } from "../utils"
import { formatOutput } from "../output"

export function registerMeCommands(program: Command): void {
  const me = program.command("me").description("View and update your profile")

  me.command("show")
    .description("Show your profile")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient({ ...globals, personal: true })
        const profile = await withSpinner(
          "Loading profile…",
          () => client.getMe(),
          { format: globals.format }
        )

        if (globals.format === "json") {
          formatOutput(profile, "json")
          return
        }

        const p = profile as Record<string, unknown>
        const name = [p.firstName || p.first_name, p.lastName || p.last_name]
          .filter(Boolean)
          .join(" ")

        console.log("")
        if (name) console.log(`  Name:      ${name}`)
        if (p.blazetag) console.log(`  Blazetag:  @${p.blazetag}`)
        if (p.email) console.log(`  Email:     ${p.email}`)
        if (p.phoneNumber || p.phone_number)
          console.log(`  Phone:     ${p.phoneNumber || p.phone_number}`)
        if (p.id) console.log(`  ID:        ${p.id}`)
        console.log("")
      } catch (err) {
        handleError(err)
      }
    })

  me.command("blazetag <tag>")
    .description("Set your Blaze tag")
    .action(async (tag: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient({ ...globals, personal: true })
        await client.setBlazetag(tag)
        console.log(`Blaze tag set to @${tag}.`)
      } catch (err) {
        handleError(err)
      }
    })
}
