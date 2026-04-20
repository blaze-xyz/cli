import { Command } from "commander"
import { confirm } from "@inquirer/prompts"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"
import type { TeamRole } from "../../sdk/types"

export function registerTeamCommands(program: Command): void {
  const team = program.command("team").description("Manage team members")

  team
    .command("list")
    .description("List team members")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listTeamMembers()
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  team
    .command("invitations")
    .description("List pending invitations")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listPendingInvitations()
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  team
    .command("invite")
    .description("Invite a new team member")
    .requiredOption("--email <email>", "Email address")
    .requiredOption("--role <role>", "Role to assign")
    .action(async (opts: { email: string; role: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.inviteTeamMember({
          email: opts.email,
          role: opts.role as TeamRole,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  team
    .command("update-role <id>")
    .description("Update a team member's role")
    .requiredOption("--role <role>", "New role")
    .action(async (id: string, opts: { role: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.updateMemberRole(id, {
          role: opts.role as TeamRole,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  team
    .command("remove <id>")
    .description("Remove a team member")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          const confirmed = await confirm({
            message: `Remove team member ${id}?`,
          })
          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        await client.removeMember(id)
        console.log(`Team member ${id} removed.`)
      } catch (err) {
        handleError(err)
      }
    })

  team
    .command("transfer-ownership")
    .description("Transfer ownership to another team member")
    .requiredOption("--new-owner-id <id>", "New owner's member ID")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (opts: { newOwnerId: string; yes?: boolean }) => {
      try {
        if (!opts.yes) {
          const confirmed = await confirm({
            message: `Transfer ownership to ${opts.newOwnerId}? You will lose owner privileges.`,
          })
          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        await client.transferOwnership({
          new_owner_id: opts.newOwnerId,
        })
        console.log(`Ownership transferred to ${opts.newOwnerId}.`)
      } catch (err) {
        handleError(err)
      }
    })
}
